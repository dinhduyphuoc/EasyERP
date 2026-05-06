import { Prisma } from "../../../generated/prisma/client";
import { NotFoundError } from "@/common";
import type { OrderListQuery, OrderOptionSearchQuery, OrderOverviewQuery, OrderOverviewResponse } from "./order.types";
import { mapOrderForEdit, mapOrderHistoryEntry, mapOrderListItem } from "./order.mapper";
import { orderEditInclude, orderInclude } from "./order.persistence";
import {
  ORDER_PAYMENT_STATUSES,
  ORDER_PROCESSING_STATUSES,
  ORDER_TYPES,
  buildWhereClause,
  decimalToString,
  defaultPaymentStatusDescriptions,
  processingStatusPresentation,
} from "./order.helpers";
import { OrderRepository } from "./order.repository";

const orderListSelect = {
  id: true,
  order_code: true,
  order_type: true,
  order_date: true,
  customer_id: true,
  customer_code: true,
  customer_name: true,
  customer_phone: true,
  customer_email: true,
  customer_address: true,
  sub_total: true,
  discount_amount: true,
  shipping_fee: true,
  total_amount: true,
  deposit_amount: true,
  paid_amount: true,
  outstanding_amount: true,
  payment_status: true,
  processing_status: true,
  shipping_service: true,
  sales_channel: true,
  warehouse_status: true,
  tracking_code: true,
  shipping_status: true,
  invoice_code: true,
  invoice_snapshot_json: true,
  created_by: true,
  confirmed_by: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.OrderSelect;

const resolveOverviewPeriodRange = (period: OrderOverviewQuery["period"]) => {
  const now = new Date();

  const start = new Date(now);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (period === "today") {
    start.setHours(0, 0, 0, 0);
    return { gte: start, lte: end };
  }

  if (period === "this_month") {
    start.setFullYear(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    return { gte: start, lte: end };
  }

  if (period === "this_quarter") {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    start.setFullYear(now.getFullYear(), quarterStartMonth, 1);
    start.setHours(0, 0, 0, 0);
    return { gte: start, lte: end };
  }

  if (period === "last_6_months") {
    start.setFullYear(now.getFullYear(), now.getMonth() - 5, 1);
    start.setHours(0, 0, 0, 0);
    return { gte: start, lte: end };
  }

  start.setFullYear(now.getFullYear(), 0, 1);
  start.setHours(0, 0, 0, 0);
  return { gte: start, lte: end };
};

const resolvePreviousOverviewPeriodRange = (period: OrderOverviewQuery["period"]) => {
  const currentRange = resolveOverviewPeriodRange(period);

  if (!currentRange?.gte || !currentRange?.lte) {
    return undefined;
  }

  const currentStart = currentRange.gte;
  const currentEnd = currentRange.lte;
  const durationMs = currentEnd.getTime() - currentStart.getTime() + 1;
  const previousEnd = new Date(currentStart.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - durationMs + 1);

  return {
    gte: previousStart,
    lte: previousEnd,
  };
};

const buildOverviewSummary = (input: {
  totalOrders: number;
  unpaidOrders: number;
  pendingShippingOrders: number;
  deliveringOrders: number;
  cancelledOrders: number;
  netRevenue: number;
  totalCost: number;
  soldQuantity: number;
}) => ({
  net_revenue: input.netRevenue.toFixed(0),
  total_cost: input.totalCost.toFixed(0),
  gross_profit: (input.netRevenue - input.totalCost).toFixed(0),
  gross_margin_percent:
    (input.totalCost > 0 ? ((input.netRevenue - input.totalCost) / input.totalCost) * 100 : 0).toFixed(2),
  total_orders: input.totalOrders,
  unpaid_orders: input.unpaidOrders,
  average_order_value: (input.totalOrders > 0 ? input.netRevenue / input.totalOrders : 0).toFixed(0),
  sold_quantity: input.soldQuantity,
  pending_shipping_orders: input.pendingShippingOrders,
  delivering_orders: input.deliveringOrders,
  cancelled_orders: input.cancelledOrders,
});

export const getOrderOptions = async (storeId: string) => {
  const [historicalShippingServices, connectedShippingProviders, salesChannels] = await Promise.all([
    OrderRepository.findOrders({
      where: { store_id: storeId, shipping_service: { not: null } },
      distinct: ["shipping_service"],
      select: { shipping_service: true },
      orderBy: [{ shipping_service: "asc" }],
    }),
    OrderRepository.findShippingConnections({
      where: { status: "connected", store_id: storeId },
      distinct: ["provider_id"],
      select: {
        provider: {
          select: {
            display_name: true,
          },
        },
      },
      orderBy: [{ provider_id: "asc" }],
    }),
    OrderRepository.findOrders({
      where: { store_id: storeId, sales_channel: { not: null } },
      distinct: ["sales_channel"],
      select: { sales_channel: true },
      orderBy: [{ sales_channel: "asc" }],
    }),
  ]);

  return {
    payment_statuses: ORDER_PAYMENT_STATUSES.map((value) => ({
      value,
      label: value,
      description: defaultPaymentStatusDescriptions[value],
    })),
    processing_statuses: ORDER_PROCESSING_STATUSES.map((value) => ({
      value,
      label: processingStatusPresentation[value].label,
      description: processingStatusPresentation[value].description,
    })),
    order_types: ORDER_TYPES.map((value) => ({
      value,
      label: value,
    })),
    customers: [],
    products: [],
    shipping_services: historicalShippingServices
      .map((item) => item.shipping_service)
      .filter((value): value is string => Boolean(value)),
    shipping_providers: connectedShippingProviders
      .map((item) => item.provider?.display_name)
      .filter((value): value is string => Boolean(value)),
    sales_channels: salesChannels
      .map((item) => item.sales_channel)
      .filter((value): value is string => Boolean(value)),
  };
};

export const getOrderOverview = async (
  storeId: string,
  query: OrderOverviewQuery,
): Promise<OrderOverviewResponse> => {
  const source = (query.source ?? "").trim();
  const period =
    query.period && ["today", "this_month", "this_quarter", "last_6_months", "this_year"].includes(query.period)
      ? query.period
      : "today";
  const orderDate = resolveOverviewPeriodRange(period);
  const previousOrderDate = resolvePreviousOverviewPeriodRange(period);
  const sourceFilter = source && source.toLowerCase() !== "all" ? source : null;
  const baseWhere: Prisma.OrderWhereInput = {
    store_id: storeId,
    order_type: "sale",
    ...(sourceFilter ? { sales_channel: sourceFilter } : {}),
    ...(orderDate ? { order_date: orderDate } : {}),
  };
  const previousWhere: Prisma.OrderWhereInput | null = previousOrderDate
    ? {
        store_id: storeId,
        order_type: "sale",
        ...(sourceFilter ? { sales_channel: sourceFilter } : {}),
        order_date: previousOrderDate,
      }
    : null;
  const successfulStatuses: Array<"placed" | "delivering" | "delivered" | "completed"> = [
    "placed",
    "delivering",
    "delivered",
    "completed",
  ];

  const queryOverviewSummary = async (where: Prisma.OrderWhereInput) => {
    const [
      totalOrders,
      unpaidOrders,
      pendingShippingOrders,
      deliveringOrders,
      cancelledOrders,
      revenueAggregate,
      soldQuantityAggregate,
      costItems,
    ] = await Promise.all([
      OrderRepository.countOrders({ where }),
      OrderRepository.countOrders({
        where: {
          ...where,
          payment_status: "unpaid",
          processing_status: {
            notIn: ["cancelled", "returned"],
          },
        },
      }),
      OrderRepository.countOrders({
        where: {
          ...where,
          processing_status: "placed",
        },
      }),
      OrderRepository.countOrders({
        where: {
          ...where,
          processing_status: "delivering",
        },
      }),
      OrderRepository.countOrders({
        where: {
          ...where,
          processing_status: "cancelled",
        },
      }),
      OrderRepository.aggregateOrders({
        where: {
          ...where,
          processing_status: {
            in: successfulStatuses,
          },
        },
        _sum: {
          total_amount: true,
        },
      }),
      OrderRepository.aggregateOrderItems({
        where: {
          order: {
            ...where,
            processing_status: {
              in: successfulStatuses,
            },
          },
        },
        _sum: {
          quantity: true,
        },
      }),
      OrderRepository.findOrderItems({
        where: {
          order: {
            ...where,
            processing_status: {
              in: successfulStatuses,
            },
          },
        },
        select: {
          quantity: true,
          variant: {
            select: {
              cogs: true,
            },
          },
        },
      }),
    ]);

    const totalCost = costItems.reduce((sum, item) => {
      const cogs = Number(item.variant?.cogs ?? 0);
      return sum + cogs * item.quantity;
    }, 0);

    return buildOverviewSummary({
      totalOrders,
      unpaidOrders,
      pendingShippingOrders,
      deliveringOrders,
      cancelledOrders,
      netRevenue: Number(revenueAggregate._sum.total_amount ?? 0),
      totalCost,
      soldQuantity: soldQuantityAggregate._sum.quantity ?? 0,
    });
  };

  const [summary, previousSummary, sourceOptions] = await Promise.all([
    queryOverviewSummary(baseWhere),
    previousWhere ? queryOverviewSummary(previousWhere) : Promise.resolve(null),
    OrderRepository.findOrders({
      where: {
        store_id: storeId,
        order_type: "sale",
        sales_channel: {
          not: null,
        },
      },
      distinct: ["sales_channel"],
      select: {
        sales_channel: true,
      },
      orderBy: [{ sales_channel: "asc" }],
    }),
  ]);

  return {
    source_options: sourceOptions
      .map((item) => item.sales_channel?.trim())
      .filter((value): value is string => Boolean(value)),
    summary,
    previous_summary: previousSummary,
  };
};

const resolveSearchLimit = (value: string | undefined, fallback = 20) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, 50);
};

const resolveIds = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);

const resolveSkus = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const searchOrderCustomers = async (storeId: string, query: OrderOptionSearchQuery) => {
  const keyword = (query.search ?? "").trim();
  const ids = resolveIds(query.ids);
  const limit = resolveSearchLimit(query.limit);
  const customers = await OrderRepository.findCustomers({
    where: {
      store_id: storeId,
      status: "active",
      ...(ids.length > 0
        ? { id: { in: ids } }
        : keyword
          ? {
              OR: [
                { full_name: { contains: keyword, mode: "insensitive" } },
                { client_code: { contains: keyword, mode: "insensitive" } },
                { phone: { contains: keyword, mode: "insensitive" } },
              ],
            }
          : {}),
    },
    select: {
      id: true,
      client_code: true,
      full_name: true,
      phone: true,
      addresses: {
        where: { is_default: true },
        select: {
          id: true,
          address: {
            select: {
              id: true,
              state_id: true,
              city_id: true,
              district_id: true,
              address_line: true,
              address_line2: true,
              state_name: true,
              city_name: true,
              district_name: true,
              postal_code: true,
              country_code: true,
              latitude: true,
              longitude: true,
              note: true,
            },
          },
        },
        take: 1,
      },
    },
    orderBy: [{ full_name: "asc" }],
    take: ids.length > 0 ? Math.max(ids.length, limit) : limit,
  });

  return customers.map((customer) => ({
    id: customer.id,
    client_code: customer.client_code,
    full_name: customer.full_name,
    phone: customer.phone,
    default_address: customer.addresses[0]
      ? {
          id: customer.addresses[0].id,
          address: {
            id: customer.addresses[0].address.id,
            state_id: customer.addresses[0].address.state_id,
            city_id: customer.addresses[0].address.city_id,
            district_id: customer.addresses[0].address.district_id,
            address_line: customer.addresses[0].address.address_line,
            address_line2: customer.addresses[0].address.address_line2,
            state_name: customer.addresses[0].address.state_name,
            city_name: customer.addresses[0].address.city_name,
            district_name: customer.addresses[0].address.district_name,
            postal_code: customer.addresses[0].address.postal_code,
            country_code: customer.addresses[0].address.country_code,
            latitude: customer.addresses[0].address.latitude?.toString() ?? null,
            longitude: customer.addresses[0].address.longitude?.toString() ?? null,
            note: customer.addresses[0].address.note,
          },
        }
      : null,
  }));
};

export const searchOrderProducts = async (storeId: string, query: OrderOptionSearchQuery) => {
  const keyword = (query.search ?? "").trim();
  const skus = resolveSkus(query.skus);
  const limit = resolveSearchLimit(query.limit);
  const variants = await OrderRepository.findProductVariants({
    where: {
      status: "active",
      store_id: storeId,
      ...(skus.length > 0
        ? { sku: { in: skus } }
        : keyword
          ? {
              OR: [
                { sku: { contains: keyword, mode: "insensitive" } },
                { product: { product_name: { contains: keyword, mode: "insensitive" } } },
              ],
            }
          : {}),
    },
    select: {
      sku: true,
      kind: true,
      selling_price: true,
      image_url: true,
      product_id: true,
      inventory_stock: {
        select: {
          on_hand: true,
          available: true,
        },
      },
      product: {
        select: {
          product_name: true,
          image_url: true,
        },
      },
    },
    orderBy: [{ sku: "asc" }],
    take: skus.length > 0 ? Math.max(skus.length, limit) : limit,
  });

  return variants.map((variant) => ({
    sku: variant.sku,
    label: `${variant.product.product_name} - ${variant.sku}`,
    variant_kind: variant.kind,
    kind: variant.kind,
    product_id: variant.product_id,
    product_name: variant.product.product_name,
    image_url: variant.image_url ?? variant.product.image_url,
    selling_price: decimalToString(variant.selling_price),
    stock_on_hand: variant.inventory_stock?.on_hand ?? 0,
    stock_available: variant.inventory_stock?.available ?? 0,
    on_hand: variant.inventory_stock?.on_hand ?? 0,
    available: variant.inventory_stock?.available ?? 0,
  }));
};

export const getOrders = async (storeId: string, query: OrderListQuery) => {
  const page = Number.isInteger(Number(query.page)) && Number(query.page) > 0 ? Number(query.page) : 1;
  const pageSize =
    Number.isInteger(Number(query.page_size)) && Number(query.page_size) > 0
      ? Math.min(Number(query.page_size), 100)
      : 10;
  const where = buildWhereClause(storeId, query);
  const [total, orders] = await Promise.all([
    OrderRepository.countOrders({ where }),
    OrderRepository.findOrders({
      where,
      select: orderListSelect,
      orderBy: [{ order_date: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: orders.map(mapOrderListItem),
    total,
    page,
    page_size: pageSize,
  };
};

export const getOrderById = async (storeId: string, id: number) => {
  const order = await OrderRepository.findOrderFirst({
    where: { id, store_id: storeId },
    include: orderEditInclude,
  });

  if (!order) {
    throw new NotFoundError("Order not found");
  }

  return mapOrderForEdit(order);
};

export const getOrderForEdit = async (storeId: string, id: number) => {
  const order = await OrderRepository.findOrderFirst({
    where: { id, store_id: storeId },
    include: orderEditInclude,
  });

  if (!order) {
    throw new NotFoundError("Order not found");
  }

  return mapOrderForEdit(order);
};

export const getOrderHistory = async (storeId: string, id: number) => {
  const order = await OrderRepository.findOrderFirst({
    where: { id, store_id: storeId },
    select: { id: true },
  });

  if (!order) {
    throw new NotFoundError("Order not found");
  }

  const history = await OrderRepository.findOrderHistory({
    where: { order_id: id },
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
  });

  return history.map(mapOrderHistoryEntry);
};
