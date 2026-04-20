import { prisma } from "@lib/prisma";
import { Prisma } from "../../../generated/prisma/client";
import { BadRequestError, NotFoundError } from "@/common";
import { InventoryOrderOrchestration } from "@/modules/inventory/inventory.service";
import type {
  DuplicateOrderRequestInput,
  OrderActionName,
  OrderActionRequestInput,
  OrderHistoryInput,
  OrderItemRequestInput,
  OrderListQuery,
  OrderPaymentStatusInput,
  OrderProcessingStatusInput,
  OrderRequestInput,
  OrderTypeInput,
  UpdateOrderRequestInput,
} from "./order.types";

const ORDER_CODE_PREFIX = "DH";
const ORDER_CODE_NUMBER_LENGTH = 4;
const ORDER_CODE_GENERATION_RETRIES = 5;
const ORDER_PAYMENT_STATUSES: OrderPaymentStatusInput[] = ["unpaid", "paid", "deposit"];
const ORDER_PROCESSING_STATUSES: OrderProcessingStatusInput[] = [
  "draft",
  "placed",
  "confirmed",
  "picked_up",
  "delivering",
  "completed",
  "cancelled",
  "returned",
];
const ORDER_TYPES: OrderTypeInput[] = ["sale", "return"];

const orderProcessingStatusLabels = {
  draft: "Nháp",
  placed: "Đặt hàng",
  confirmed: "Xác nhận",
  picked_up: "Đóng gói",
  delivering: "Giao hàng",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
  returned: "Trả hàng",
} satisfies Record<OrderProcessingStatusInput, string>;

const defaultPaymentStatusDescriptions = {
  unpaid:
    "Chưa có giao dịch thanh toán. Có thể lưu nhập hoặc chờ xác nhận, nhưng không được hoàn thành đơn.",
  paid:
    "Đã thu đủ tiền cho đơn hàng. Có thể tiếp tục reserve kho, giao vận và kết thúc đơn.",
  deposit:
    "Đã thu tiền cọc một phần. Đơn vẫn được xử lý tiếp nhưng cần thu nốt trước khi completed.",
} satisfies Record<OrderPaymentStatusInput, string>;

const defaultProcessingStatusDescriptions = {
  draft: "Đơn nhập chờ duyệt nội bộ hoặc bổ sung thông tin.",
  placed: "Đơn đã được tạo và ghi nhận thông tin đặt hàng ban đầu.",
  confirmed: "Đơn đã được xác nhận và sẵn sàng xử lý kho.",
  picked_up: "Đơn vị vận chuyển đã lấy hàng hoặc đã xác nhận nhận hàng.",
  delivering: "Đơn hàng đang trong quá trình giao cho khách.",
  completed: "Đơn hàng hoàn tất, đã đối soát thanh toán và chứng từ.",
  cancelled: "Đơn hàng đã bị hủy trước khi hoàn tất.",
  returned: "Đơn hàng trả về hoặc hoàn trả từ khách.",
} satisfies Record<OrderProcessingStatusInput, string>;

const defaultTimelineTemplate = {
  placed: {
    stage: "Đặt hàng",
    date: null,
    actor: null,
    sales_channel: null,
    payment_type: null,
    sub_total: null,
    deposit_amount: null,
  },
  confirmed: {
    stage: "Xác nhận",
    date: null,
    actor: null,
    warehouse_status: null,
    note: null,
    conditions: null,
  },
  picked_up: {
    stage: "DVVC lấy hàng",
    shipping_service: null,
    tracking_code: null,
    pickup_date: null,
    pickup_address: null,
    receiver_name: null,
  },
  delivering: {
    stage: "Giao hàng",
    delivery_date: null,
    shipping_fee: null,
    shipping_status: null,
    tracking_code: null,
  },
  completed: {
    stage: "Hoàn thành",
    completed_date: null,
    invoice_code: null,
    total_amount: null,
    paid_amount: null,
    outstanding_amount: null,
  },
} satisfies Record<string, Record<string, unknown>>;

const toOptionalTrimmedString = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseOptionalPositiveInt = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BadRequestError(`${fieldName} must be a positive integer`);
  }

  return parsed;
};

const parseRequiredPositiveInt = (value: unknown, fieldName: string) => {
  const parsed = parseOptionalPositiveInt(value, fieldName);

  if (!parsed) {
    throw new BadRequestError(`${fieldName} is required`);
  }

  return parsed;
};

const parseOptionalDate = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestError(`${fieldName} must be a valid date`);
  }

  return date;
};

const parseDecimal = (value: unknown, fieldName: string, defaultValue = 0) => {
  if (value === undefined || value === null || value === "") {
    return new Prisma.Decimal(defaultValue);
  }

  try {
    return new Prisma.Decimal(value as string | number | Prisma.Decimal);
  } catch {
    throw new BadRequestError(`${fieldName} must be a valid number`);
  }
};

const parseOrderPaymentStatus = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return "unpaid" as const;
  }

  if (typeof value === "string" && ORDER_PAYMENT_STATUSES.includes(value as OrderPaymentStatusInput)) {
    return value as OrderPaymentStatusInput;
  }

  throw new BadRequestError(`payment_status must be one of: ${ORDER_PAYMENT_STATUSES.join(", ")}`);
};

const parseOrderProcessingStatus = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return "draft" as const;
  }

  if (
    typeof value === "string" &&
    ORDER_PROCESSING_STATUSES.includes(value as OrderProcessingStatusInput)
  ) {
    return value as OrderProcessingStatusInput;
  }

  throw new BadRequestError(
    `processing_status must be one of: ${ORDER_PROCESSING_STATUSES.join(", ")}`,
  );
};

const parseOrderType = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return "sale" as const;
  }

  if (typeof value === "string" && ORDER_TYPES.includes(value as OrderTypeInput)) {
    return value as OrderTypeInput;
  }

  throw new BadRequestError(`order_type must be one of: ${ORDER_TYPES.join(", ")}`);
};

const decimalToString = (value: Prisma.Decimal | null | undefined) => {
  if (!value) {
    return "0";
  }

  return value.toString();
};

const decimalToNullableString = (value: Prisma.Decimal | null | undefined) => {
  if (!value) {
    return null;
  }

  return value.toString();
};

const mergeTimeline = (
  inputTimeline: Record<string, unknown> | undefined,
  runtimeTimeline: Record<string, Record<string, unknown>>,
) => {
  const merged: Record<string, Record<string, unknown>> = {
    ...defaultTimelineTemplate,
  };

  for (const [stage, data] of Object.entries(runtimeTimeline)) {
    merged[stage] = {
      ...(merged[stage] ?? {}),
      ...data,
    };
  }

  if (inputTimeline && typeof inputTimeline === "object") {
    for (const [stage, data] of Object.entries(inputTimeline)) {
      merged[stage] = {
        ...(merged[stage] ?? {}),
        ...(typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {}),
      };
    }
  }

  return merged;
};

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    items: true;
    history: true;
  };
}>;

const getOrderForMutation = async (id: number) => {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: [{ id: "asc" }],
      },
      history: {
        orderBy: [{ created_at: "asc" }, { id: "asc" }],
      },
    },
  });

  if (!order) {
    throw new NotFoundError("Order not found");
  }

  return order;
};

const updateOrderStageTimeline = (
  currentTimeline: Prisma.JsonValue,
  stage: string,
  patch: Record<string, unknown>,
) => {
  const stagePatch = {
    [stage]: {
      ...patch,
      timestamp: new Date().toISOString(),
    },
  };

  return mergeTimeline(
    currentTimeline && typeof currentTimeline === "object"
      ? (currentTimeline as Record<string, unknown>)
      : undefined,
    stagePatch,
  );
};

const generateInvoiceCode = (orderCode: string) => {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `EINV-${stamp}-${orderCode}`;
};

const persistOrderMutation = async ({
  orderId,
  data,
  historyEntry,
  beforeUpdate,
}: {
  orderId: number;
  data: Prisma.OrderUpdateInput;
  historyEntry?: {
    event_type: string;
    description: string;
    actor_name: string | null;
    metadata: Prisma.InputJsonValue;
  };
  beforeUpdate?: (tx: Prisma.TransactionClient) => Promise<void>;
}) => {
  return prisma.$transaction(async (tx) => {
    if (beforeUpdate) {
      await beforeUpdate(tx);
    }

    if (historyEntry) {
      await tx.orderHistory.create({
        data: {
          order_id: orderId,
          event_type: historyEntry.event_type,
          description: historyEntry.description,
          actor_name: historyEntry.actor_name,
          metadata: historyEntry.metadata,
        },
      });
    }

    return tx.order.update({
      where: { id: orderId },
      data,
      include: {
        items: {
          orderBy: [{ id: "asc" }],
        },
        history: {
          orderBy: [{ created_at: "asc" }, { id: "asc" }],
        },
      },
    });
  });
};

const generateNextOrderCode = async (tx: Prisma.TransactionClient) => {
  const codeRegex = `${ORDER_CODE_PREFIX}([0-9]+)$`;
  const matchingPattern = `^${ORDER_CODE_PREFIX}[0-9]+$`;
  const rows = await tx.$queryRaw<Array<{ max_sequence: number | null }>>(Prisma.sql`
    SELECT MAX(SUBSTRING(order_code FROM ${codeRegex})::integer) AS max_sequence
    FROM "Order"
    WHERE order_code ~ ${matchingPattern}
  `);
  const nextSequence = (rows[0]?.max_sequence ?? 0) + 1;

  return `${ORDER_CODE_PREFIX}${String(nextSequence).padStart(ORDER_CODE_NUMBER_LENGTH, "0")}`;
};

const isDuplicateGeneratedOrderCodeError = (error: unknown) => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  const targets = Array.isArray(error.meta?.target) ? error.meta.target : [];
  return targets.includes("order_code");
};

const mapOrderItem = (item: {
  id: number;
  product_id: number | null;
  variant_sku: string | null;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: Prisma.Decimal;
  discount_amount: Prisma.Decimal;
  sub_total: Prisma.Decimal;
  notes: string | null;
}) => ({
  id: item.id,
  product_id: item.product_id,
  variant_sku: item.variant_sku,
  product_name: item.product_name,
  sku: item.sku,
  quantity: item.quantity,
  unit_price: decimalToString(item.unit_price),
  discount_amount: decimalToString(item.discount_amount),
  sub_total: decimalToString(item.sub_total),
  notes: item.notes,
});

const mapOrderHistory = (entry: {
  id: number;
  event_type: string;
  description: string;
  actor_name: string | null;
  metadata: Prisma.JsonValue;
  created_at: Date;
}) => ({
  id: entry.id,
  event_type: entry.event_type,
  description: entry.description,
  actor_name: entry.actor_name,
  metadata: entry.metadata,
  timestamp: entry.created_at.toISOString(),
});

const mapOrder = (order: {
  id: number;
  order_code: string;
  order_type: OrderTypeInput;
  order_date: Date;
  customer_id: number | null;
  customer_code: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  customer_address: string | null;
  sub_total: Prisma.Decimal;
  tax_amount: Prisma.Decimal;
  shipping_fee: Prisma.Decimal;
  total_amount: Prisma.Decimal;
  deposit_amount: Prisma.Decimal;
  paid_amount: Prisma.Decimal;
  outstanding_amount: Prisma.Decimal;
  payment_status: OrderPaymentStatusInput;
  processing_status: OrderProcessingStatusInput;
  shipping_service: string | null;
  sales_channel: string | null;
  order_notes: string | null;
  payment_notes: string | null;
  warehouse_status: string | null;
  tracking_code: string | null;
  shipping_status: string | null;
  invoice_code: string | null;
  created_by: string | null;
  confirmed_by: string | null;
  status_timeline: Prisma.JsonValue;
  created_at: Date;
  updated_at: Date;
  items?: Array<{
    id: number;
    product_id: number | null;
    variant_sku: string | null;
    product_name: string;
    sku: string;
    quantity: number;
    unit_price: Prisma.Decimal;
    discount_amount: Prisma.Decimal;
    sub_total: Prisma.Decimal;
    notes: string | null;
  }>;
  history?: Array<{
    id: number;
    event_type: string;
    description: string;
    actor_name: string | null;
    metadata: Prisma.JsonValue;
    created_at: Date;
  }>;
}) => ({
  id: order.id,
  order_code: order.order_code,
  order_type: order.order_type,
  order_date: order.order_date.toISOString(),
  customer_id: order.customer_id,
  customer_info: {
    customer_code: order.customer_code,
    name: order.customer_name,
    phone: order.customer_phone,
    email: order.customer_email,
    address: order.customer_address,
  },
  sub_total: decimalToString(order.sub_total),
  tax_amount: decimalToString(order.tax_amount),
  shipping_fee: decimalToString(order.shipping_fee),
  total_amount: decimalToString(order.total_amount),
  deposit_amount: decimalToString(order.deposit_amount),
  paid_amount: decimalToString(order.paid_amount),
  outstanding_amount: decimalToString(order.outstanding_amount),
  payment_status: order.payment_status,
  processing_status: order.processing_status,
  shipping_service: order.shipping_service,
  sales_channel: order.sales_channel,
  order_notes: order.order_notes,
  payment_notes: order.payment_notes,
  warehouse_status: order.warehouse_status,
  tracking_code: order.tracking_code,
  shipping_status: order.shipping_status,
  invoice_code: order.invoice_code,
  created_by: order.created_by,
  confirmed_by: order.confirmed_by,
  status_timeline: order.status_timeline,
  created_at: order.created_at.toISOString(),
  updated_at: order.updated_at.toISOString(),
  order_items: order.items?.map(mapOrderItem) ?? [],
  order_history: order.history?.map(mapOrderHistory) ?? [],
});

const buildWhereClause = (query: OrderListQuery): Prisma.OrderWhereInput => {
  const search = toOptionalTrimmedString(query.search)?.toLowerCase();
  const paymentStatus =
    query.payment_status === undefined ? undefined : parseOrderPaymentStatus(query.payment_status);
  const processingStatus =
    query.processing_status === undefined
      ? undefined
      : parseOrderProcessingStatus(query.processing_status);
  const orderType =
    query.order_type === undefined ? undefined : parseOrderType(query.order_type);
  const customerId = parseOptionalPositiveInt(query.customer_id, "customer_id");
  const view = toOptionalTrimmedString(query.view) as OrderListQuery["view"] | undefined;

  const where: Prisma.OrderWhereInput = {
    ...(paymentStatus ? { payment_status: paymentStatus } : {}),
    ...(processingStatus ? { processing_status: processingStatus } : {}),
    ...(orderType ? { order_type: orderType } : {}),
    ...(customerId ? { customer_id: customerId } : {}),
  };

  if (search) {
    where.OR = [
      { order_code: { contains: search, mode: "insensitive" } },
      { customer_name: { contains: search, mode: "insensitive" } },
      { customer_phone: { contains: search, mode: "insensitive" } },
      { customer_code: { contains: search, mode: "insensitive" } },
      { tracking_code: { contains: search, mode: "insensitive" } },
      { shipping_service: { contains: search, mode: "insensitive" } },
      { sales_channel: { contains: search, mode: "insensitive" } },
    ];
  }

  if (view === "drafts") {
    where.processing_status = "draft";
  }

  if (view === "returns") {
    where.OR = [
      { order_type: "return" },
      { processing_status: "returned" },
    ];
  }

  if (view === "cancelled") {
    where.processing_status = "cancelled";
  }

  if (view === "incomplete") {
    const existingAnd = Array.isArray(where.AND)
      ? where.AND
      : where.AND
        ? [where.AND]
        : [];
    where.AND = [
      ...existingAnd,
      {
        OR: [
          { payment_status: { not: "paid" } },
          { processing_status: { not: "completed" } },
        ],
      },
    ];
  }

  return where;
};

const validateRequestedHistory = (items: OrderHistoryInput[] | undefined) => {
  if (!items) {
    return [];
  }

  return items
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const eventType = toOptionalTrimmedString(item.event_type);
      const description = toOptionalTrimmedString(item.description);

      if (!eventType || !description) {
        throw new BadRequestError("order_history items must include event_type and description");
      }

      return {
        event_type: eventType,
        description,
        actor_name: toOptionalTrimmedString(item.actor_name) ?? null,
        metadata:
          item.metadata && typeof item.metadata === "object"
            ? (item.metadata as Prisma.InputJsonValue)
            : Prisma.JsonNull,
      };
    });
};

const buildHistoryEntries = (input: {
  paymentStatus: OrderPaymentStatusInput;
  processingStatus: OrderProcessingStatusInput;
  salesChannel: string | null;
  createdBy: string | null;
  shippingService: string | null;
  trackingCode: string | null;
  orderNotes: string | null;
  depositAmount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  requestedHistory: ReturnType<typeof validateRequestedHistory>;
}) => {
  const baseEntries: Array<{
    event_type: string;
    description: string;
    actor_name: string | null;
    metadata: Prisma.InputJsonValue;
  }> = [
    {
      event_type: "order_created",
      description: "Tạo đơn hàng mới",
      actor_name: input.createdBy,
      metadata: {
        sales_channel: input.salesChannel,
        payment_status: input.paymentStatus,
        processing_status: input.processingStatus,
      },
    },
  ];

  if (input.paymentStatus === "deposit") {
    baseEntries.push({
      event_type: "payment_updated",
      description: "Ghi nhận thanh toán đặt cọc",
      actor_name: input.createdBy,
      metadata: {
        payment_status: input.paymentStatus,
        deposit_amount: input.depositAmount.toString(),
        outstanding_amount: input.totalAmount.minus(input.paidAmount).toString(),
      },
    });
  }

  if (input.paymentStatus === "paid") {
    baseEntries.push({
      event_type: "payment_updated",
      description: "Đơn hàng đã được thanh toán",
      actor_name: input.createdBy,
      metadata: {
        payment_status: input.paymentStatus,
        paid_amount: input.paidAmount.toString(),
      },
    });
  }

  if (input.processingStatus !== "draft") {
    baseEntries.push({
      event_type: "status_changed",
      description: `Cập nhật trạng thái xử lý sang ${input.processingStatus}`,
      actor_name: input.createdBy,
      metadata: {
        processing_status: input.processingStatus,
      },
    });
  }

  if (input.shippingService || input.trackingCode) {
    baseEntries.push({
      event_type: "shipping_updated",
      description: "Cập nhật thông tin vận chuyển",
      actor_name: input.createdBy,
      metadata: {
        shipping_service: input.shippingService,
        tracking_code: input.trackingCode,
      },
    });
  }

  if (input.orderNotes) {
    baseEntries.push({
      event_type: "note_added",
      description: "Thêm ghi chú đơn hàng",
      actor_name: input.createdBy,
      metadata: {
        order_notes: input.orderNotes,
      },
    });
  }

  return [...baseEntries, ...input.requestedHistory];
};

const buildNormalizedItems = async (items: OrderItemRequestInput[]) => {
  const requestedVariantSkus = items
    .map((item) => toOptionalTrimmedString(item.variant_sku))
    .filter((value): value is string => Boolean(value));
  const requestedProductIds = items
    .map((item) => (item.product_id === null ? undefined : parseOptionalPositiveInt(item.product_id, "product_id")))
    .filter((value): value is number => Boolean(value));

  const [variants, products] = await Promise.all([
    requestedVariantSkus.length > 0
      ? prisma.productVariant.findMany({
          where: { sku: { in: requestedVariantSkus } },
          include: {
            product: {
              select: {
                id: true,
                product_name: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    requestedProductIds.length > 0
      ? prisma.product.findMany({
          where: { id: { in: requestedProductIds } },
          select: {
            id: true,
            product_name: true,
            sku: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const variantMap = new Map(variants.map((variant) => [variant.sku, variant]));
  const productMap = new Map(products.map((product) => [product.id, product]));

  return items.map((item, index) => {
    const quantity = parseRequiredPositiveInt(item.quantity, `order_items[${index}].quantity`);
    const unitPrice = parseDecimal(item.unit_price, `order_items[${index}].unit_price`);
    const discountAmount = parseDecimal(
      item.discount_amount,
      `order_items[${index}].discount_amount`,
      0,
    );
    const variantSku = toOptionalTrimmedString(item.variant_sku) ?? null;
    const productId =
      item.product_id === null || item.product_id === undefined
        ? null
        : parseOptionalPositiveInt(item.product_id, `order_items[${index}].product_id`) ?? null;
    const variant = variantSku ? variantMap.get(variantSku) : undefined;
    const product = productId ? productMap.get(productId) : undefined;
    const productName =
      toOptionalTrimmedString(item.product_name) ??
      variant?.product.product_name ??
      product?.product_name;
    const sku = toOptionalTrimmedString(item.sku) ?? variantSku ?? product?.sku ?? undefined;

    if (!productName) {
      throw new BadRequestError(`order_items[${index}].product_name is required`);
    }

    if (!sku) {
      throw new BadRequestError(`order_items[${index}].sku is required`);
    }

    if (variantSku && !variant) {
      throw new BadRequestError(`Variant "${variantSku}" was not found`);
    }

    if (productId && !product && !variant) {
      throw new BadRequestError(`Product "${productId}" was not found`);
    }

    const calculatedSubTotal = unitPrice.mul(quantity).minus(discountAmount);

    return {
      product_id: variant?.product.id ?? productId,
      variant_sku: variantSku,
      product_name: productName,
      sku,
      quantity,
      unit_price: unitPrice,
      discount_amount: discountAmount,
      sub_total: calculatedSubTotal,
      notes: toOptionalTrimmedString(item.notes) ?? null,
    };
  });
};

export const OrderService = {
  getOrderOptions: async () => {
    const [customers, variants, shippingServices, salesChannels] = await Promise.all([
      prisma.customer.findMany({
        where: { status: "active" },
        select: {
          id: true,
          client_code: true,
          full_name: true,
          phone: true,
        },
        orderBy: [{ full_name: "asc" }],
      }),
      prisma.productVariant.findMany({
        where: { status: "active" },
        select: {
          sku: true,
          selling_price: true,
          product_id: true,
          product: {
            select: {
              product_name: true,
            },
          },
        },
        orderBy: [{ sku: "asc" }],
      }),
      prisma.order.findMany({
        where: { shipping_service: { not: null } },
        distinct: ["shipping_service"],
        select: { shipping_service: true },
        orderBy: [{ shipping_service: "asc" }],
      }),
      prisma.order.findMany({
        where: { sales_channel: { not: null } },
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
        label: orderProcessingStatusLabels[value],
        description: defaultProcessingStatusDescriptions[value],
      })),
      order_types: ORDER_TYPES.map((value) => ({
        value,
        label: value,
      })),
      customers: customers.map((customer) => ({
        id: customer.id,
        client_code: customer.client_code,
        full_name: customer.full_name,
        phone: customer.phone,
      })),
      products: variants.map((variant) => ({
        sku: variant.sku,
        label: `${variant.product.product_name} - ${variant.sku}`,
        product_id: variant.product_id,
        product_name: variant.product.product_name,
        selling_price: decimalToString(variant.selling_price),
      })),
      shipping_services: shippingServices
        .map((item) => item.shipping_service)
        .filter((value): value is string => Boolean(value)),
      sales_channels: salesChannels
        .map((item) => item.sales_channel)
        .filter((value): value is string => Boolean(value)),
    };
  },

  getOrders: async (query: OrderListQuery) => {
    const orders = await prisma.order.findMany({
      where: buildWhereClause(query),
      include: {
        items: true,
      },
      orderBy: [{ order_date: "desc" }, { id: "desc" }],
    });

    return orders.map(mapOrder);
  },

  getOrderById: async (id: number) => {
    const order = await getOrderForMutation(id);
    return mapOrder(order);
  },

  duplicateOrder: async (id: number, input: DuplicateOrderRequestInput = {}) => {
    const existingOrder = await getOrderForMutation(id);
    const actorName = toOptionalTrimmedString(input.actor_name) ?? "System";
    const duplicatedOrderDate = parseOptionalDate(input.order_date, "order_date")?.toISOString();

    return OrderService.createOrder({
      order_date: duplicatedOrderDate,
      order_type: existingOrder.order_type,
      customer_id: existingOrder.customer_id,
      customer_info: {
        customer_code: existingOrder.customer_code,
        name: existingOrder.customer_name,
        phone: existingOrder.customer_phone,
        email: existingOrder.customer_email,
        address: existingOrder.customer_address,
      },
      tax_amount: existingOrder.tax_amount.toString(),
      shipping_fee: existingOrder.shipping_fee.toString(),
      deposit_amount: 0,
      paid_amount: 0,
      payment_status: "unpaid",
      processing_status: "draft",
      shipping_service: existingOrder.shipping_service,
      sales_channel: existingOrder.sales_channel,
      order_notes: existingOrder.order_notes,
      payment_notes: null,
      warehouse_status: null,
      tracking_code: null,
      shipping_status: null,
      invoice_code: null,
      created_by: actorName,
      confirmed_by: null,
      status_timeline: {},
      order_history: [
        {
          event_type: "order_duplicated",
          description: `Nhan ban tu don ${existingOrder.order_code}`,
          actor_name: actorName,
          metadata: {
            source_order_id: existingOrder.id,
            source_order_code: existingOrder.order_code,
          },
        },
      ],
      order_items: existingOrder.items.map((item) => ({
        product_id: item.product_id,
        variant_sku: item.variant_sku,
        product_name: item.product_name,
        sku: item.sku,
        quantity: item.quantity,
        unit_price: item.unit_price.toString(),
        discount_amount: item.discount_amount.toString(),
        notes: item.notes ?? undefined,
      })),
    });
  },

  createOrder: async (input: OrderRequestInput) => {
    const orderCode = toOptionalTrimmedString(input.order_code);
    const orderDate = parseOptionalDate(input.order_date, "order_date") ?? new Date();
    const orderType = parseOrderType(input.order_type);
    const paymentStatus = parseOrderPaymentStatus(input.payment_status);
    const processingStatus = parseOrderProcessingStatus(input.processing_status);
    const customerId =
      input.customer_id === null || input.customer_id === undefined
        ? null
        : parseOptionalPositiveInt(input.customer_id, "customer_id") ?? null;
    const shippingService = toOptionalTrimmedString(input.shipping_service) ?? null;
    const salesChannel = toOptionalTrimmedString(input.sales_channel) ?? null;
    const orderNotes = toOptionalTrimmedString(input.order_notes) ?? null;
    const paymentNotes = toOptionalTrimmedString(input.payment_notes) ?? null;
    const warehouseStatus = toOptionalTrimmedString(input.warehouse_status) ?? null;
    const trackingCode = toOptionalTrimmedString(input.tracking_code) ?? null;
    const shippingStatus = toOptionalTrimmedString(input.shipping_status) ?? null;
    const invoiceCode = toOptionalTrimmedString(input.invoice_code) ?? null;
    const createdBy = toOptionalTrimmedString(input.created_by) ?? "System";
    const confirmedBy = toOptionalTrimmedString(input.confirmed_by) ?? null;
    const requestedHistory = validateRequestedHistory(input.order_history);
    const requestedItems = Array.isArray(input.order_items) ? input.order_items : [];
    const normalizedItems = await buildNormalizedItems(requestedItems);

    if (normalizedItems.length === 0 && processingStatus !== "draft") {
      throw new BadRequestError("order_items must contain at least one item unless the order is a draft");
    }

    const customer = customerId
      ? await prisma.customer.findUnique({
          where: { id: customerId },
          select: {
            id: true,
            client_code: true,
            full_name: true,
            phone: true,
          },
        })
      : null;

    if (customerId && !customer) {
      throw new BadRequestError("customer_id is invalid");
    }

    const customerName =
      toOptionalTrimmedString(input.customer_info?.name) ?? customer?.full_name;
    const customerPhone =
      toOptionalTrimmedString(input.customer_info?.phone) ?? customer?.phone;
    const customerCode =
      toOptionalTrimmedString(input.customer_info?.customer_code) ?? customer?.client_code ?? null;
    const customerEmail = toOptionalTrimmedString(input.customer_info?.email) ?? null;
    const customerAddress = toOptionalTrimmedString(input.customer_info?.address) ?? null;

    if (!customerName) {
      throw new BadRequestError("customer_info.name is required");
    }

    if (!customerPhone) {
      throw new BadRequestError("customer_info.phone is required");
    }

    const calculatedSubTotal = normalizedItems.reduce(
      (sum, item) => sum.plus(item.sub_total),
      new Prisma.Decimal(0),
    );
    const subTotal =
      normalizedItems.length > 0
        ? calculatedSubTotal
        : parseDecimal(input.sub_total, "sub_total", 0);
    const taxAmount = parseDecimal(input.tax_amount, "tax_amount", 0);
    const shippingFee = parseDecimal(input.shipping_fee, "shipping_fee", 0);
    const totalAmount = subTotal.plus(taxAmount).plus(shippingFee);
    const depositAmount = parseDecimal(input.deposit_amount, "deposit_amount", 0);
    let paidAmount = parseDecimal(input.paid_amount, "paid_amount", 0);

    if (paymentStatus === "unpaid") {
      if (depositAmount.gt(0) || paidAmount.gt(0)) {
        throw new BadRequestError("unpaid orders cannot include deposit_amount or paid_amount");
      }
    }

    if (paymentStatus === "deposit") {
      if (depositAmount.lte(0)) {
        throw new BadRequestError("deposit orders must include deposit_amount greater than 0");
      }

      if (depositAmount.gt(totalAmount)) {
        throw new BadRequestError("deposit_amount cannot exceed total_amount");
      }

      if (paidAmount.lt(depositAmount)) {
        paidAmount = depositAmount;
      }
    }

    if (paymentStatus === "paid") {
      paidAmount = totalAmount;
    }

    const outstandingAmount = totalAmount.minus(paidAmount);

    if (outstandingAmount.lt(0)) {
      throw new BadRequestError("paid_amount cannot exceed total_amount");
    }

    if (processingStatus === "completed" && paymentStatus !== "paid") {
      throw new BadRequestError("Only fully paid orders can be moved to completed");
    }

    const runtimeTimeline = {
      placed: {
        date: orderDate.toISOString(),
        actor: createdBy,
        sales_channel: salesChannel,
        payment_type: paymentStatus,
        sub_total: subTotal.toString(),
        deposit_amount: depositAmount.toString(),
      },
      confirmed: {
        actor: confirmedBy,
        warehouse_status: warehouseStatus,
      },
      picked_up: {
        shipping_service: shippingService,
        tracking_code: trackingCode,
        pickup_address: customerAddress,
        receiver_name: customerName,
      },
      delivering: {
        shipping_fee: shippingFee.toString(),
        shipping_status: shippingStatus,
        tracking_code: trackingCode,
      },
      completed: {
        invoice_code: invoiceCode,
        total_amount: totalAmount.toString(),
        paid_amount: paidAmount.toString(),
        outstanding_amount: outstandingAmount.toString(),
      },
    };
    const statusTimeline = mergeTimeline(input.status_timeline, runtimeTimeline);
    const historyEntries = buildHistoryEntries({
      paymentStatus,
      processingStatus,
      salesChannel,
      createdBy,
      shippingService,
      trackingCode,
      orderNotes,
      depositAmount,
      paidAmount,
      totalAmount,
      requestedHistory,
    });

    for (let attempt = 0; attempt < ORDER_CODE_GENERATION_RETRIES; attempt += 1) {
      try {
        const createdOrder = await prisma.$transaction(async (tx) => {
          const resolvedOrderCode = orderCode ?? (await generateNextOrderCode(tx));

          const existingOrder = await tx.order.findFirst({
            where: { order_code: resolvedOrderCode },
            select: { id: true },
          });

          if (existingOrder) {
            throw new BadRequestError(`Order code "${resolvedOrderCode}" already exists`);
          }

          const order = await tx.order.create({
            data: {
              order_code: resolvedOrderCode,
              order_type: orderType,
              order_date: orderDate,
              customer_id: customerId,
              customer_code: customerCode,
              customer_name: customerName,
              customer_phone: customerPhone,
              customer_email: customerEmail,
              customer_address: customerAddress,
              sub_total: subTotal,
              tax_amount: taxAmount,
              shipping_fee: shippingFee,
              total_amount: totalAmount,
              deposit_amount: depositAmount,
              paid_amount: paidAmount,
              outstanding_amount: outstandingAmount,
              payment_status: paymentStatus,
              processing_status: processingStatus,
              shipping_service: shippingService,
              sales_channel: salesChannel,
              order_notes: orderNotes,
              payment_notes: paymentNotes,
              warehouse_status: warehouseStatus,
              tracking_code: trackingCode,
              shipping_status: shippingStatus,
              invoice_code: invoiceCode,
              created_by: createdBy,
              confirmed_by: confirmedBy,
              status_timeline: statusTimeline as Prisma.InputJsonValue,
              items: {
                create: normalizedItems,
              },
              history: {
                create: historyEntries,
              },
            },
            include: {
              items: {
                orderBy: [{ id: "asc" }],
              },
              history: {
                orderBy: [{ created_at: "asc" }, { id: "asc" }],
              },
            },
          });

          if (order.processing_status === "confirmed") {
            await InventoryOrderOrchestration.reserveForOrder({
              tx,
              items: order.items,
              actorName: createdBy,
              referenceId: String(order.id),
              referenceCode: order.order_code,
              note: "Order confirmed and inventory reserved",
              mutation: "reserve",
            });
          }

          if (order.processing_status === "picked_up") {
            await InventoryOrderOrchestration.reserveForOrder({
              tx,
              items: order.items,
              actorName: createdBy,
              referenceId: String(order.id),
              referenceCode: order.order_code,
              note: "Order created directly in picked up stage",
              mutation: "reserve",
            });
            await InventoryOrderOrchestration.moveOrderToPacking({
              tx,
              items: order.items,
              actorName: createdBy,
              referenceId: String(order.id),
              referenceCode: order.order_code,
              note: "Order moved to packing on create",
              mutation: "move_to_packing",
            });
          }

          if (order.processing_status === "delivering" || order.processing_status === "completed") {
            await InventoryOrderOrchestration.reserveForOrder({
              tx,
              items: order.items,
              actorName: createdBy,
              referenceId: String(order.id),
              referenceCode: order.order_code,
              note: "Order inventory reserved on create",
              mutation: "reserve",
            });
            await InventoryOrderOrchestration.moveOrderToPacking({
              tx,
              items: order.items,
              actorName: createdBy,
              referenceId: String(order.id),
              referenceCode: order.order_code,
              note: "Order moved to packing on create",
              mutation: "move_to_packing",
            });
          }

          if (order.processing_status === "completed") {
            await InventoryOrderOrchestration.fulfillOrder({
              tx,
              items: order.items,
              actorName: createdBy,
              referenceId: String(order.id),
              referenceCode: order.order_code,
              note: "Order fulfilled on create",
              mutation: "fulfill",
            });
          }

          return order;
        });

        return mapOrder(createdOrder);
      } catch (error) {
        if (orderCode || !isDuplicateGeneratedOrderCodeError(error)) {
          throw error;
        }
      }
    }

    throw new BadRequestError("Unable to generate a unique order code");
  },

  updateOrder: async (id: number, input: UpdateOrderRequestInput) => {
    const existingOrder = await getOrderForMutation(id);
    if (!["draft", "placed"].includes(existingOrder.processing_status)) {
      throw new BadRequestError("Only draft or placed orders can be edited");
    }

    const orderCode = toOptionalTrimmedString(input.order_code) ?? existingOrder.order_code;
    const orderDate = parseOptionalDate(input.order_date, "order_date") ?? existingOrder.order_date;
    const orderType = parseOrderType(input.order_type ?? existingOrder.order_type);
    const paymentStatus = parseOrderPaymentStatus(input.payment_status ?? existingOrder.payment_status);
    const processingStatus = parseOrderProcessingStatus(
      input.processing_status ?? existingOrder.processing_status,
    );
    const customerId =
      input.customer_id === undefined
        ? existingOrder.customer_id
        : input.customer_id === null
          ? null
          : parseOptionalPositiveInt(input.customer_id, "customer_id") ?? null;
    const shippingService =
      input.shipping_service === undefined
        ? existingOrder.shipping_service
        : toOptionalTrimmedString(input.shipping_service) ?? null;
    const salesChannel =
      input.sales_channel === undefined
        ? existingOrder.sales_channel
        : toOptionalTrimmedString(input.sales_channel) ?? null;
    const orderNotes =
      input.order_notes === undefined
        ? existingOrder.order_notes
        : toOptionalTrimmedString(input.order_notes) ?? null;
    const paymentNotes =
      input.payment_notes === undefined
        ? existingOrder.payment_notes
        : toOptionalTrimmedString(input.payment_notes) ?? null;
    const warehouseStatus =
      input.warehouse_status === undefined
        ? existingOrder.warehouse_status
        : toOptionalTrimmedString(input.warehouse_status) ?? null;
    const trackingCode =
      input.tracking_code === undefined
        ? existingOrder.tracking_code
        : toOptionalTrimmedString(input.tracking_code) ?? null;
    const shippingStatus =
      input.shipping_status === undefined
        ? existingOrder.shipping_status
        : toOptionalTrimmedString(input.shipping_status) ?? null;
    const invoiceCode =
      input.invoice_code === undefined
        ? existingOrder.invoice_code
        : toOptionalTrimmedString(input.invoice_code) ?? null;
    const createdBy = toOptionalTrimmedString(input.created_by) ?? existingOrder.created_by ?? "System";
    const confirmedBy =
      input.confirmed_by === undefined
        ? existingOrder.confirmed_by
        : toOptionalTrimmedString(input.confirmed_by) ?? null;
    const requestedItems = Array.isArray(input.order_items)
      ? input.order_items
      : existingOrder.items.map((item) => ({
          product_id: item.product_id,
          variant_sku: item.variant_sku,
          product_name: item.product_name,
          sku: item.sku,
          quantity: item.quantity,
          unit_price: item.unit_price.toString(),
          discount_amount: item.discount_amount.toString(),
          notes: item.notes ?? undefined,
        }));
    const normalizedItems = await buildNormalizedItems(requestedItems);

    if (normalizedItems.length === 0 && processingStatus !== "draft") {
      throw new BadRequestError("order_items must contain at least one item unless the order is a draft");
    }

    const customer = customerId
      ? await prisma.customer.findUnique({
          where: { id: customerId },
          select: {
            id: true,
            client_code: true,
            full_name: true,
            phone: true,
          },
        })
      : null;

    if (customerId && !customer) {
      throw new BadRequestError("customer_id is invalid");
    }

    const customerName =
      toOptionalTrimmedString(input.customer_info?.name) ??
      existingOrder.customer_name ??
      customer?.full_name;
    const customerPhone =
      toOptionalTrimmedString(input.customer_info?.phone) ??
      existingOrder.customer_phone ??
      customer?.phone;
    const customerCode =
      toOptionalTrimmedString(input.customer_info?.customer_code) ??
      existingOrder.customer_code ??
      customer?.client_code ??
      null;
    const customerEmail =
      input.customer_info?.email === undefined
        ? existingOrder.customer_email
        : toOptionalTrimmedString(input.customer_info?.email) ?? null;
    const customerAddress =
      input.customer_info?.address === undefined
        ? existingOrder.customer_address
        : toOptionalTrimmedString(input.customer_info?.address) ?? null;

    if (!customerName) {
      throw new BadRequestError("customer_info.name is required");
    }

    if (!customerPhone) {
      throw new BadRequestError("customer_info.phone is required");
    }

    const subTotal = normalizedItems.reduce((sum, item) => sum.plus(item.sub_total), new Prisma.Decimal(0));
    const taxAmount =
      input.tax_amount === undefined
        ? existingOrder.tax_amount
        : parseDecimal(input.tax_amount, "tax_amount", 0);
    const shippingFee =
      input.shipping_fee === undefined
        ? existingOrder.shipping_fee
        : parseDecimal(input.shipping_fee, "shipping_fee", 0);
    const totalAmount = subTotal.plus(taxAmount).plus(shippingFee);
    const depositAmount =
      input.deposit_amount === undefined
        ? existingOrder.deposit_amount
        : parseDecimal(input.deposit_amount, "deposit_amount", 0);
    let paidAmount =
      input.paid_amount === undefined
        ? existingOrder.paid_amount
        : parseDecimal(input.paid_amount, "paid_amount", 0);

    if (paymentStatus === "unpaid") {
      if (depositAmount.gt(0) || paidAmount.gt(0)) {
        throw new BadRequestError("unpaid orders cannot include deposit_amount or paid_amount");
      }
    }

    if (paymentStatus === "deposit") {
      if (depositAmount.lte(0)) {
        throw new BadRequestError("deposit orders must include deposit_amount greater than 0");
      }

      if (depositAmount.gt(totalAmount)) {
        throw new BadRequestError("deposit_amount cannot exceed total_amount");
      }

      if (paidAmount.lt(depositAmount)) {
        paidAmount = depositAmount;
      }
    }

    if (paymentStatus === "paid") {
      paidAmount = totalAmount;
    }

    const outstandingAmount = totalAmount.minus(paidAmount);

    if (outstandingAmount.lt(0)) {
      throw new BadRequestError("paid_amount cannot exceed total_amount");
    }

    if (processingStatus === "completed" && paymentStatus !== "paid") {
      throw new BadRequestError("Only fully paid orders can be moved to completed");
    }

    const runtimeTimeline = {
      placed: {
        date: orderDate.toISOString(),
        actor: createdBy,
        sales_channel: salesChannel,
        payment_type: paymentStatus,
        sub_total: subTotal.toString(),
        deposit_amount: depositAmount.toString(),
      },
      confirmed: {
        actor: confirmedBy,
        warehouse_status: warehouseStatus,
      },
      picked_up: {
        shipping_service: shippingService,
        tracking_code: trackingCode,
        pickup_address: customerAddress,
        receiver_name: customerName,
      },
      delivering: {
        shipping_fee: shippingFee.toString(),
        shipping_status: shippingStatus,
        tracking_code: trackingCode,
      },
      completed: {
        invoice_code: invoiceCode,
        total_amount: totalAmount.toString(),
        paid_amount: paidAmount.toString(),
        outstanding_amount: outstandingAmount.toString(),
      },
    };

    const statusTimeline = mergeTimeline(
      input.status_timeline ?? (existingOrder.status_timeline as Record<string, unknown>),
      runtimeTimeline,
    );

    const updatedOrder = await prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({
        where: { order_id: id },
      });

      await tx.orderHistory.create({
        data: {
          order_id: id,
          event_type: "order_updated",
          description: "Cap nhat noi dung don hang",
          actor_name: createdBy,
          metadata: {
            payment_status: paymentStatus,
            processing_status: processingStatus,
            total_amount: totalAmount.toString(),
            item_count: normalizedItems.length,
          },
        },
      });

      return tx.order.update({
        where: { id },
        data: {
          order_code: orderCode,
          order_type: orderType,
          order_date: orderDate,
          customer_id: customerId,
          customer_code: customerCode,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_email: customerEmail,
          customer_address: customerAddress,
          sub_total: subTotal,
          tax_amount: taxAmount,
          shipping_fee: shippingFee,
          total_amount: totalAmount,
          deposit_amount: depositAmount,
          paid_amount: paidAmount,
          outstanding_amount: outstandingAmount,
          payment_status: paymentStatus,
          processing_status: processingStatus,
          shipping_service: shippingService,
          sales_channel: salesChannel,
          order_notes: orderNotes,
          payment_notes: paymentNotes,
          warehouse_status: warehouseStatus,
          tracking_code: trackingCode,
          shipping_status: shippingStatus,
          invoice_code: invoiceCode,
          created_by: createdBy,
          confirmed_by: confirmedBy,
          status_timeline: statusTimeline as Prisma.InputJsonValue,
          items: {
            create: normalizedItems,
          },
        },
        include: {
          items: {
            orderBy: [{ id: "asc" }],
          },
          history: {
            orderBy: [{ created_at: "asc" }, { id: "asc" }],
          },
        },
      });
    });

    return mapOrder(updatedOrder);
  },

  runAction: async (id: number, action: OrderActionName, input: OrderActionRequestInput) => {
    const existingOrder = await getOrderForMutation(id);
    const actorName = toOptionalTrimmedString(input.actor_name) ?? "System";
    const note = toOptionalTrimmedString(input.note) ?? null;
    const shippingService =
      toOptionalTrimmedString(input.shipping_service) ?? existingOrder.shipping_service;
    const trackingCode =
      toOptionalTrimmedString(input.tracking_code) ?? existingOrder.tracking_code;
    const shippingStatus =
      toOptionalTrimmedString(input.shipping_status) ?? existingOrder.shipping_status;
    const warehouseStatus =
      toOptionalTrimmedString(input.warehouse_status) ?? existingOrder.warehouse_status;
    const invoiceCode =
      toOptionalTrimmedString(input.invoice_code) ??
      existingOrder.invoice_code ??
      generateInvoiceCode(existingOrder.order_code);

    let nextData: Prisma.OrderUpdateInput = {};
    let historyEntry: {
      event_type: string;
      description: string;
      actor_name: string | null;
      metadata: Prisma.InputJsonValue;
    } | undefined;

    if (action === "confirm") {
      if (!["draft", "placed"].includes(existingOrder.processing_status)) {
        throw new BadRequestError("Only draft or placed orders can be confirmed");
      }

      nextData = {
        processing_status: "confirmed",
        confirmed_by: actorName,
        warehouse_status: warehouseStatus ?? "confirmed",
        status_timeline: updateOrderStageTimeline(existingOrder.status_timeline, "confirmed", {
          actor: actorName,
          note,
          warehouse_status: warehouseStatus ?? "confirmed",
        }) as Prisma.InputJsonValue,
      };
      historyEntry = {
        event_type: "status_changed",
        description: "Xac nhan don hang",
        actor_name: actorName,
        metadata: {
          processing_status: "confirmed",
          warehouse_status: warehouseStatus ?? "confirmed",
          note,
        },
      };
    }

    if (action === "confirm_shipping") {
      if (existingOrder.processing_status !== "confirmed") {
        throw new BadRequestError("Only confirmed orders can move to confirm shipping");
      }

      nextData = {
        processing_status: "picked_up",
        warehouse_status: warehouseStatus ?? "ready_to_ship",
        shipping_service: shippingService,
        tracking_code: trackingCode,
        status_timeline: updateOrderStageTimeline(existingOrder.status_timeline, "picked_up", {
          actor: actorName,
          shipping_service: shippingService,
          tracking_code: trackingCode,
          warehouse_status: warehouseStatus ?? "ready_to_ship",
          note,
        }) as Prisma.InputJsonValue,
      };
      historyEntry = {
        event_type: "status_changed",
        description: "Xac nhan giao hang",
        actor_name: actorName,
        metadata: {
          processing_status: "picked_up",
          shipping_service: shippingService,
          tracking_code: trackingCode,
          note,
        },
      };
    }

    if (action === "push_to_delivery") {
      if (!["confirmed", "picked_up"].includes(existingOrder.processing_status)) {
        throw new BadRequestError("Only confirmed or picked up orders can be pushed to delivery");
      }

      nextData = {
        processing_status: "delivering",
        shipping_service: shippingService,
        tracking_code: trackingCode,
        shipping_status: shippingStatus ?? "delivering",
        status_timeline: updateOrderStageTimeline(existingOrder.status_timeline, "delivering", {
          actor: actorName,
          shipping_service: shippingService,
          tracking_code: trackingCode,
          shipping_status: shippingStatus ?? "delivering",
          note,
        }) as Prisma.InputJsonValue,
      };
      historyEntry = {
        event_type: "shipping_updated",
        description: "Day don sang don vi van chuyen",
        actor_name: actorName,
        metadata: {
          processing_status: "delivering",
          shipping_service: shippingService,
          tracking_code: trackingCode,
          shipping_status: shippingStatus ?? "delivering",
          note,
        },
      };
    }

    if (action === "mark_paid") {
      if (existingOrder.payment_status === "paid" && existingOrder.outstanding_amount.lte(0)) {
        return mapOrder(existingOrder);
      }

      nextData = {
        payment_status: "paid",
        deposit_amount: existingOrder.deposit_amount,
        paid_amount: existingOrder.total_amount,
        outstanding_amount: new Prisma.Decimal(0),
        payment_notes: note ?? existingOrder.payment_notes,
        status_timeline: updateOrderStageTimeline(existingOrder.status_timeline, "completed", {
          actor: actorName,
          paid_amount: existingOrder.total_amount.toString(),
          outstanding_amount: "0",
          payment_status: "paid",
        }) as Prisma.InputJsonValue,
      };
      historyEntry = {
        event_type: "payment_updated",
        description: "Danh dau don hang da thanh toan",
        actor_name: actorName,
        metadata: {
          payment_status: "paid",
          paid_amount: existingOrder.total_amount.toString(),
          note,
        },
      };
    }

    if (action === "request_invoice") {
      nextData = {
        invoice_code: invoiceCode,
        status_timeline: updateOrderStageTimeline(existingOrder.status_timeline, "completed", {
          actor: actorName,
          invoice_code: invoiceCode,
        }) as Prisma.InputJsonValue,
      };
      historyEntry = {
        event_type: "invoice_requested",
        description: "Yeu cau xuat hoa don dien tu",
        actor_name: actorName,
        metadata: {
          invoice_code: invoiceCode,
          note,
        },
      };
    }

    if (action === "complete") {
      if (existingOrder.payment_status !== "paid") {
        throw new BadRequestError("Only fully paid orders can be completed");
      }

      if (!["delivering", "picked_up"].includes(existingOrder.processing_status)) {
        throw new BadRequestError("Only delivering or picked up orders can be completed");
      }

      nextData = {
        processing_status: "completed",
        shipping_status: shippingStatus ?? "delivered",
        invoice_code: existingOrder.invoice_code ?? invoiceCode,
        status_timeline: updateOrderStageTimeline(existingOrder.status_timeline, "completed", {
          actor: actorName,
          shipping_status: shippingStatus ?? "delivered",
          invoice_code: existingOrder.invoice_code ?? invoiceCode,
          paid_amount: existingOrder.total_amount.toString(),
          outstanding_amount: existingOrder.outstanding_amount.toString(),
          note,
        }) as Prisma.InputJsonValue,
      };
      historyEntry = {
        event_type: "status_changed",
        description: "Hoan thanh don hang",
        actor_name: actorName,
        metadata: {
          processing_status: "completed",
          shipping_status: shippingStatus ?? "delivered",
          invoice_code: existingOrder.invoice_code ?? invoiceCode,
          note,
        },
      };
    }

    if (action === "cancel") {
      if (!["draft", "placed", "confirmed", "picked_up"].includes(existingOrder.processing_status)) {
        throw new BadRequestError("Only draft, placed, confirmed or picked up orders can be cancelled");
      }

      if (existingOrder.payment_status === "paid") {
        throw new BadRequestError("Paid orders cannot be cancelled directly");
      }

      nextData = {
        processing_status: "cancelled",
        shipping_status: existingOrder.shipping_status ?? "cancelled",
        status_timeline: updateOrderStageTimeline(existingOrder.status_timeline, "completed", {
          actor: actorName,
          shipping_status: "cancelled",
          note: note ?? "Order cancelled",
        }) as Prisma.InputJsonValue,
      };
      historyEntry = {
        event_type: "order_cancelled",
        description: "Huy don hang",
        actor_name: actorName,
        metadata: {
          processing_status: "cancelled",
          payment_status: existingOrder.payment_status,
          note,
        },
      };
    }

    if (action === "return_order") {
      if (existingOrder.processing_status !== "completed") {
        throw new BadRequestError("Only completed orders can be returned");
      }

      nextData = {
        processing_status: "returned",
        shipping_status: "returned",
        status_timeline: updateOrderStageTimeline(existingOrder.status_timeline, "completed", {
          actor: actorName,
          shipping_status: "returned",
          note: note ?? "Order returned",
        }) as Prisma.InputJsonValue,
      };
      historyEntry = {
        event_type: "order_returned",
        description: "Ghi nhan tra hang",
        actor_name: actorName,
        metadata: {
          processing_status: "returned",
          payment_status: existingOrder.payment_status,
          note,
        },
      };
    }

    if (!historyEntry) {
      throw new BadRequestError(`Unsupported action: ${action}`);
    }

    const updatedOrder = await persistOrderMutation({
      orderId: id,
      data: nextData,
      historyEntry,
      beforeUpdate:
        action === "confirm"
          ? async (tx) => {
              await InventoryOrderOrchestration.reserveForOrder({
                tx,
                items: existingOrder.items,
                actorName,
                referenceId: String(existingOrder.id),
                referenceCode: existingOrder.order_code,
                note: note ?? "Order confirmed and inventory reserved",
                mutation: "reserve",
              });
            }
          : action === "confirm_shipping"
            ? async (tx) => {
                await InventoryOrderOrchestration.moveOrderToPacking({
                  tx,
                  items: existingOrder.items,
                  actorName,
                  referenceId: String(existingOrder.id),
                  referenceCode: existingOrder.order_code,
                  note: note ?? "Inventory moved to packing",
                  mutation: "move_to_packing",
                });
              }
            : action === "complete"
              ? async (tx) => {
                  await InventoryOrderOrchestration.fulfillOrder({
                    tx,
                    items: existingOrder.items,
                    actorName,
                    referenceId: String(existingOrder.id),
                    referenceCode: existingOrder.order_code,
                    note: note ?? "Order fulfilled",
                    mutation: "fulfill",
                  });
                }
              : action === "cancel"
                ? async (tx) => {
                    if (existingOrder.processing_status === "confirmed") {
                      await InventoryOrderOrchestration.releaseForOrder({
                        tx,
                        items: existingOrder.items,
                        actorName,
                        referenceId: String(existingOrder.id),
                        referenceCode: existingOrder.order_code,
                        note: note ?? "Order cancelled and inventory released",
                        mutation: "reserve",
                      });
                    }

                    if (existingOrder.processing_status === "picked_up") {
                      await InventoryOrderOrchestration.cancelPackingForOrder({
                        tx,
                        items: existingOrder.items,
                        actorName,
                        referenceId: String(existingOrder.id),
                        referenceCode: existingOrder.order_code,
                        note: note ?? "Cancel packing before releasing inventory",
                        mutation: "reserve",
                      });
                      await InventoryOrderOrchestration.releaseForOrder({
                        tx,
                        items: existingOrder.items,
                        actorName,
                        referenceId: String(existingOrder.id),
                        referenceCode: existingOrder.order_code,
                        note: note ?? "Order cancelled and inventory released",
                        mutation: "reserve",
                      });
                    }
                  }
              : action === "return_order"
                ? async (tx) => {
                    await InventoryOrderOrchestration.restockReturnedOrder({
                      tx,
                      items: existingOrder.items,
                      actorName,
                      referenceId: String(existingOrder.id),
                      referenceCode: existingOrder.order_code,
                      note: note ?? "Returned order restocked to inventory",
                      mutation: "reserve",
                    });
                  }
              : undefined,
    });

    return mapOrder(updatedOrder);
  },
};
