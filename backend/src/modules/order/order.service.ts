import { prisma } from "@lib/prisma";
import { createGHNClient } from "@/lib/ghn";
import { Prisma } from "../../../generated/prisma/client";
import { BadRequestError, NotFoundError } from "@/common";
import { InventoryOrderOrchestration } from "@/modules/inventory/inventory.service";
import type {
  AddressRequestInput,
  DuplicateOrderRequestInput,
  OrderActionName,
  OrderActionRequestInput,
  OrderHistoryInput,
  OrderItemRequestInput,
  OrderListQuery,
  OrderPaymentStatusInput,
  OrderProcessingStatusInput,
  OrderRequestInput,
  OrderShippingPrintResponse,
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

const processingStatusPresentation: Record<
  OrderProcessingStatusInput,
  { label: string; description: string }
> = {
  draft: {
    label: "Nháp",
    description: "Đơn nháp chờ xác nhận và bổ sung thông tin.",
  },
  placed: {
    label: "Cho xác nhận",
    description: "Đơn đã tạo và đang chờ sales/ops xác nhận trước khi xử lý kho.",
  },
  confirmed: {
    label: "Đã xác nhận",
    description: "Đơn đã được xác nhận và sẵn sàng đưa sang kho xử lý.",
  },
  picked_up: {
    label: "Đóng gói",
    description: "Kho đã đóng gói xong và sẵn sàng bàn giao vận chuyển hoặc giao nội bộ.",
  },
  delivering: {
    label: "Đang giao",
    description: "Đơn đang trong quá trình giao đến khách hàng.",
  },
  completed: {
    label: "Hoàn thành",
    description: "Đơn đã hoàn tất và đối soát thanh toán.",
  },
  cancelled: {
    label: "Đã hủy",
    description: "Đơn đã bị hủy trước khi hoàn tất.",
  },
  returned: {
    label: "Trả hàng",
    description: "Đơn đã hoàn tất nhưng phát sinh trả hàng.",
  },
};

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
  cancelled: {
    stage: "Cancelled",
    cancelled_date: null,
    reason: null,
    actor: null,
  },
  returned: {
    stage: "Returned",
    returned_date: null,
    reason: null,
    actor: null,
  },
  payment: {
    stage: "Payment",
    paid_amount: null,
    outstanding_amount: null,
    payment_status: null,
    actor: null,
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

const parseOptionalNonNegativeInt = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new BadRequestError(`${fieldName} must be a non-negative integer`);
  }

  return parsed;
};

const parseOptionalIntArray = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new BadRequestError(`${fieldName} must be an array of integers`);
  }

  return value.map((item, index) => {
    const parsed = Number(item);

    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new BadRequestError(`${fieldName}[${index}] must be a non-negative integer`);
    }

    return parsed;
  });
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

const parseDecimalOrNull = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null || value === "") {
    return null;
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
    from_address_detail: true;
    to_address_detail: true;
    return_address_detail: true;
  };
}>;

const orderInclude = {
  items: {
    orderBy: [{ id: "asc" }],
  },
  history: {
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
  },
  from_address_detail: true,
  to_address_detail: true,
  return_address_detail: true,
} satisfies Prisma.OrderInclude;

const getOrderForMutation = async (storeId: string, id: number) => {
  const order = await prisma.order.findFirst({
    where: { id, store_id: storeId },
    include: orderInclude,
  });

  if (!order) {
    throw new NotFoundError("Order not found");
  }

  return order;
};

const getConnectedGHNCredentials = async (storeId: string) => {
  const provider = await prisma.shippingProvider.findUnique({
    where: { code: "ghn" },
    select: { id: true },
  });

  if (!provider) {
    throw new NotFoundError("GHN provider is not configured");
  }

  const connection = await prisma.shippingConnection.findUnique({
    where: {
      provider_id_store_id: {
        provider_id: provider.id,
        store_id: storeId,
      },
    },
    select: {
      status: true,
      credentials_json: true,
    },
  });

  if (!connection || connection.status !== "connected") {
    throw new BadRequestError("GHN connection is not available for this store");
  }

  if (
    !connection.credentials_json ||
    typeof connection.credentials_json !== "object" ||
    Array.isArray(connection.credentials_json)
  ) {
    throw new BadRequestError("GHN credentials are missing");
  }

  const credentials = connection.credentials_json as Record<string, unknown>;
  const token = typeof credentials.token === "string" ? credentials.token.trim() : "";
  const shopId = typeof credentials.shop_id === "string" ? credentials.shop_id.trim() : "";

  if (!token) {
    throw new BadRequestError("GHN token is missing");
  }

  if (!shopId) {
    throw new BadRequestError("GHN shop_id is missing");
  }

  return { token, shopId };
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
      include: orderInclude,
    });
  });
};

const generateNextOrderCode = async (tx: Prisma.TransactionClient, storeId: string) => {
  const codeRegex = `${ORDER_CODE_PREFIX}([0-9]+)$`;
  const matchingPattern = `^${ORDER_CODE_PREFIX}[0-9]+$`;
  const rows = await tx.$queryRaw<Array<{ max_sequence: number | null }>>(Prisma.sql`
    SELECT MAX(SUBSTRING(order_code FROM ${codeRegex})::integer) AS max_sequence
    FROM "Order"
    WHERE order_code ~ ${matchingPattern}
      AND store_id = ${storeId}
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
  item_weight: number | null;
  item_length: number | null;
  item_width: number | null;
  item_height: number | null;
  category_level1: string | null;
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
  item_weight: item.item_weight,
  item_length: item.item_length,
  item_width: item.item_width,
  item_height: item.item_height,
  category_level1: item.category_level1,
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

const mapAddress = (address: {
  id: number;
  state_id: number;
  city_id: number;
  district_id: number | null;
  address_line: string;
  address_line2: string | null;
  state_name: string;
  city_name: string;
  district_name: string | null;
  postal_code: string | null;
  country_code: string;
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
  note: string | null;
} | null) => {
  if (!address) {
    return null;
  }

  return {
    id: address.id,
    state_id: address.state_id,
    city_id: address.city_id,
    district_id: address.district_id,
    address_line: address.address_line,
    address_line2: address.address_line2,
    state_name: address.state_name,
    city_name: address.city_name,
    district_name: address.district_name,
    postal_code: address.postal_code,
    country_code: address.country_code,
    latitude: address.latitude?.toString() ?? null,
    longitude: address.longitude?.toString() ?? null,
    note: address.note,
  };
};

const getOrCreateAddress = async (
  tx: Prisma.TransactionClient,
  input: AddressRequestInput | null | undefined,
  fieldName: string,
) => {
  const existingAddressId =
    input?.id === null || input?.id === undefined
      ? null
      : parseOptionalPositiveInt(input.id, `${fieldName}.id`) ?? null;

  if (existingAddressId) {
    const address = await tx.address.findUnique({
      where: { id: existingAddressId },
      select: { id: true },
    });

    if (!address) {
      throw new BadRequestError(`${fieldName}.id is invalid`);
    }

    return address.id;
  }

  if (!input || typeof input !== "object") {
    return null;
  }

  const stateId = parseOptionalPositiveInt(input.state_id, `${fieldName}.state_id`);
  const cityId = parseOptionalPositiveInt(input.city_id, `${fieldName}.city_id`);
  const districtId =
    input.district_id === null || input.district_id === undefined
      ? null
      : parseOptionalPositiveInt(input.district_id, `${fieldName}.district_id`) ?? null;
  const addressLine = toOptionalTrimmedString(input.address_line);

  if (!stateId) {
    throw new BadRequestError(`${fieldName}.state_id is required`);
  }

  if (!cityId) {
    throw new BadRequestError(`${fieldName}.city_id is required`);
  }

  if (!addressLine) {
    throw new BadRequestError(`${fieldName}.address_line is required`);
  }

  const [state, city, district] = await Promise.all([
    tx.state.findUnique({ where: { id: stateId }, select: { id: true, name: true } }),
    tx.city.findUnique({ where: { id: cityId }, select: { id: true, state_id: true, name: true } }),
    districtId
      ? tx.district.findUnique({
          where: { id: districtId },
          select: { id: true, city_id: true, name: true },
        })
      : Promise.resolve(null),
  ]);

  if (!state) {
    throw new BadRequestError(`${fieldName}.state_id is invalid`);
  }

  if (!city || city.state_id !== state.id) {
    throw new BadRequestError(`${fieldName}.city_id is invalid for the selected state`);
  }

  if (districtId && (!district || district.city_id !== city.id)) {
    throw new BadRequestError(`${fieldName}.district_id is invalid for the selected city`);
  }

  const address = await tx.address.create({
    data: {
      state_id: state.id,
      city_id: city.id,
      district_id: district?.id ?? null,
      address_line: addressLine,
      address_line2: toOptionalTrimmedString(input.address_line2) ?? null,
      state_name: state.name,
      city_name: city.name,
      district_name: district?.name ?? null,
      postal_code: toOptionalTrimmedString(input.postal_code) ?? null,
      country_code: toOptionalTrimmedString(input.country_code) ?? "VN",
      latitude: parseDecimalOrNull(input.latitude, `${fieldName}.latitude`),
      longitude: parseDecimalOrNull(input.longitude, `${fieldName}.longitude`),
      note: toOptionalTrimmedString(input.note) ?? null,
    },
    select: { id: true },
  });

  return address.id;
};

const resolveOrderAddressId = async (
  tx: Prisma.TransactionClient,
  explicitAddressId: number | null,
  addressInput: AddressRequestInput | null | undefined,
  fieldName: string,
) => {
  if (explicitAddressId) {
    const address = await tx.address.findUnique({
      where: { id: explicitAddressId },
      select: { id: true },
    });

    if (!address) {
      throw new BadRequestError(`${fieldName}_id is invalid`);
    }

    return address.id;
  }

  return getOrCreateAddress(tx, addressInput, `${fieldName}_detail`);
};

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
  client_order_code: string | null;
  note: string | null;
  required_note: string | null;
  payment_type_id: number | null;
  from_address_id: number | null;
  to_address_id: number | null;
  return_address_id: number | null;
  from_name: string | null;
  from_phone: string | null;
  from_address: string | null;
  from_ward_name: string | null;
  from_district_name: string | null;
  from_province_name: string | null;
  return_phone: string | null;
  return_address: string | null;
  return_district_id: number | null;
  return_ward_code: string | null;
  to_ward_code: string | null;
  to_district_id: number | null;
  cod_amount: Prisma.Decimal;
  content: string | null;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  insurance_value: Prisma.Decimal;
  service_id: number | null;
  service_type_id: number | null;
  pick_station_id: number | null;
  deliver_station_id: number | null;
  coupon: string | null;
  pick_shift: number[];
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
    item_weight: number | null;
    item_length: number | null;
    item_width: number | null;
    item_height: number | null;
    category_level1: string | null;
  }>;
  history?: Array<{
    id: number;
    event_type: string;
    description: string;
    actor_name: string | null;
    metadata: Prisma.JsonValue;
    created_at: Date;
  }>;
  from_address_detail?: Parameters<typeof mapAddress>[0];
  to_address_detail?: Parameters<typeof mapAddress>[0];
  return_address_detail?: Parameters<typeof mapAddress>[0];
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
  client_order_code: order.client_order_code,
  note: order.note,
  required_note: order.required_note,
  payment_type_id: order.payment_type_id,
  from_address_id: order.from_address_id,
  to_address_id: order.to_address_id,
  return_address_id: order.return_address_id,
  from_address_detail: mapAddress(order.from_address_detail ?? null),
  to_address_detail: mapAddress(order.to_address_detail ?? null),
  return_address_detail: mapAddress(order.return_address_detail ?? null),
  from_name: order.from_name,
  from_phone: order.from_phone,
  from_address: order.from_address,
  from_ward_name: order.from_ward_name,
  from_district_name: order.from_district_name,
  from_province_name: order.from_province_name,
  return_phone: order.return_phone,
  return_address: order.return_address,
  return_district_id: order.return_district_id,
  return_ward_code: order.return_ward_code,
  to_ward_code: order.to_ward_code,
  to_district_id: order.to_district_id,
  cod_amount: decimalToString(order.cod_amount),
  content: order.content,
  weight: order.weight,
  length: order.length,
  width: order.width,
  height: order.height,
  insurance_value: decimalToString(order.insurance_value),
  service_id: order.service_id,
  service_type_id: order.service_type_id,
  pick_station_id: order.pick_station_id,
  deliver_station_id: order.deliver_station_id,
  coupon: order.coupon,
  pick_shift: order.pick_shift,
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

const buildWhereClause = (storeId: string, query: OrderListQuery): Prisma.OrderWhereInput => {
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
    store_id: storeId,
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

const buildNormalizedItems = async (storeId: string, items: OrderItemRequestInput[]) => {
  const requestedVariantSkus = items
    .map((item) => toOptionalTrimmedString(item.variant_sku))
    .filter((value): value is string => Boolean(value));
  const requestedProductIds = items
    .map((item) => (item.product_id === null ? undefined : parseOptionalPositiveInt(item.product_id, "product_id")))
    .filter((value): value is number => Boolean(value));

  const [variants, products] = await Promise.all([
    requestedVariantSkus.length > 0
      ? prisma.productVariant.findMany({
          where: { sku: { in: requestedVariantSkus }, store_id: storeId },
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
          where: { id: { in: requestedProductIds }, store_id: storeId },
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
      item_weight: parseOptionalNonNegativeInt(item.item_weight, `order_items[${index}].item_weight`) ?? null,
      item_length: parseOptionalNonNegativeInt(item.item_length, `order_items[${index}].item_length`) ?? null,
      item_width: parseOptionalNonNegativeInt(item.item_width, `order_items[${index}].item_width`) ?? null,
      item_height: parseOptionalNonNegativeInt(item.item_height, `order_items[${index}].item_height`) ?? null,
      category_level1: toOptionalTrimmedString(item.category_level1) ?? null,
    };
  });
};

export const OrderService = {
  getOrderOptions: async (storeId: string) => {
    const [customers, variants, historicalShippingServices, connectedShippingProviders, salesChannels] = await Promise.all([
      prisma.customer.findMany({
        where: {
          store_id: storeId,
          status: "active",
          phone: { not: null },
        },
        select: {
          id: true,
          client_code: true,
          full_name: true,
          phone: true,
          addresses: {
            where: { is_default: true },
            include: { address: true },
            take: 1,
          },
        },
        orderBy: [{ full_name: "asc" }],
      }),
      prisma.productVariant.findMany({
        where: { status: "active", store_id: storeId },
        select: {
          sku: true,
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
      }),
      prisma.order.findMany({
        where: { store_id: storeId, shipping_service: { not: null } },
        distinct: ["shipping_service"],
        select: { shipping_service: true },
        orderBy: [{ shipping_service: "asc" }],
      }),
      prisma.shippingConnection.findMany({
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
      prisma.order.findMany({
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
      customers: customers.map((customer) => ({
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
              },
            }
          : null,
      })),
      products: variants.map((variant) => ({
        sku: variant.sku,
        label: `${variant.product.product_name} - ${variant.sku}`,
        product_id: variant.product_id,
        product_name: variant.product.product_name,
        selling_price: decimalToString(variant.selling_price),
        image_url: variant.image_url ?? variant.product.image_url,
        stock_on_hand: variant.inventory_stock?.on_hand ?? 0,
        stock_available: variant.inventory_stock?.available ?? 0,
      })),
      shipping_services: Array.from(
        new Set([
          ...connectedShippingProviders.map((item) => item.provider.display_name),
          ...historicalShippingServices
            .map((item) => item.shipping_service)
            .filter((value): value is string => Boolean(value)),
        ]),
      ).sort((a, b) => a.localeCompare(b, "vi")),
      sales_channels: salesChannels
        .map((item) => item.sales_channel)
        .filter((value): value is string => Boolean(value)),
    };
  },

  getOrders: async (storeId: string, query: OrderListQuery) => {
    const orders = await prisma.order.findMany({
      where: buildWhereClause(storeId, query),
      include: {
        items: true,
        from_address_detail: true,
        to_address_detail: true,
        return_address_detail: true,
      },
      orderBy: [{ order_date: "desc" }, { id: "desc" }],
    });

    return orders.map(mapOrder);
  },

  getOrderById: async (storeId: string, id: number) => {
    const order = await getOrderForMutation(storeId, id);
    return mapOrder(order);
  },

  getGHNPrintInfo: async (storeId: string, id: number): Promise<OrderShippingPrintResponse> => {
    const order = await getOrderForMutation(storeId, id);

    if ((order.shipping_service ?? "").trim().toLowerCase() !== "ghn") {
      throw new BadRequestError("Only GHN orders can generate GHN print links");
    }

    const trackingCode = toOptionalTrimmedString(order.tracking_code);

    if (!trackingCode) {
      throw new BadRequestError("Tracking code is required before printing GHN shipping labels");
    }

    const { token, shopId } = await getConnectedGHNCredentials(storeId);
    const ghnClient = createGHNClient({
      token,
      shopId,
    });
    const response = await ghnClient.order.printOrder({
      order_codes: [trackingCode],
    });

    const printToken = response.data?.token;
    const printUrls = response.print_urls;

    if (!printToken || !printUrls) {
      throw new BadRequestError("GHN did not return a printable label token");
    }

    return {
      provider: "ghn",
      order_id: order.id,
      order_code: order.order_code,
      tracking_code: trackingCode,
      token: printToken,
      expires_in_minutes: 30,
      print_urls: printUrls,
    };
  },

  duplicateOrder: async (storeId: string, id: number, input: DuplicateOrderRequestInput = {}) => {
    const existingOrder = await getOrderForMutation(storeId, id);
    const actorName = toOptionalTrimmedString(input.actor_name) ?? "System";
    const duplicatedOrderDate = parseOptionalDate(input.order_date, "order_date")?.toISOString();

    return OrderService.createOrder(storeId, {
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
      client_order_code: existingOrder.client_order_code,
      note: existingOrder.note,
      required_note: existingOrder.required_note,
      payment_type_id: existingOrder.payment_type_id,
      from_address_id: existingOrder.from_address_id,
      to_address_id: existingOrder.to_address_id,
      return_address_id: existingOrder.return_address_id,
      from_name: existingOrder.from_name,
      from_phone: existingOrder.from_phone,
      from_address: existingOrder.from_address,
      from_ward_name: existingOrder.from_ward_name,
      from_district_name: existingOrder.from_district_name,
      from_province_name: existingOrder.from_province_name,
      return_phone: existingOrder.return_phone,
      return_address: existingOrder.return_address,
      return_district_id: existingOrder.return_district_id,
      return_ward_code: existingOrder.return_ward_code,
      to_ward_code: existingOrder.to_ward_code,
      to_district_id: existingOrder.to_district_id,
      cod_amount: existingOrder.cod_amount.toString(),
      content: existingOrder.content,
      weight: existingOrder.weight,
      length: existingOrder.length,
      width: existingOrder.width,
      height: existingOrder.height,
      insurance_value: existingOrder.insurance_value.toString(),
      service_id: existingOrder.service_id,
      service_type_id: existingOrder.service_type_id,
      pick_station_id: existingOrder.pick_station_id,
      deliver_station_id: existingOrder.deliver_station_id,
      coupon: existingOrder.coupon,
      pick_shift: existingOrder.pick_shift,
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
        item_weight: item.item_weight,
        item_length: item.item_length,
        item_width: item.item_width,
        item_height: item.item_height,
        category_level1: item.category_level1 ?? undefined,
      })),
    });
  },

  createOrder: async (storeId: string, input: OrderRequestInput) => {
    const orderCode = toOptionalTrimmedString(input.order_code);
    const orderDate = parseOptionalDate(input.order_date, "order_date") ?? new Date();
    const orderType = parseOrderType(input.order_type);
    const paymentStatus = parseOrderPaymentStatus(input.payment_status);
    const processingStatus = parseOrderProcessingStatus(input.processing_status);
    const customerId =
      input.customer_id === null || input.customer_id === undefined
        ? null
        : parseOptionalPositiveInt(input.customer_id, "customer_id") ?? null;
    const clientOrderCode = toOptionalTrimmedString(input.client_order_code) ?? null;
    const note = toOptionalTrimmedString(input.note) ?? null;
    const requiredNote = toOptionalTrimmedString(input.required_note) ?? null;
    const paymentTypeId =
      input.payment_type_id === null || input.payment_type_id === undefined
        ? null
        : parseOptionalNonNegativeInt(input.payment_type_id, "payment_type_id") ?? null;
    const requestedFromAddressId =
      input.from_address_id === null || input.from_address_id === undefined
        ? null
        : parseOptionalPositiveInt(input.from_address_id, "from_address_id") ?? null;
    const requestedToAddressId =
      input.to_address_id === null || input.to_address_id === undefined
        ? null
        : parseOptionalPositiveInt(input.to_address_id, "to_address_id") ?? null;
    const requestedReturnAddressId =
      input.return_address_id === null || input.return_address_id === undefined
        ? null
        : parseOptionalPositiveInt(input.return_address_id, "return_address_id") ?? null;
    const fromName = toOptionalTrimmedString(input.from_name) ?? null;
    const fromPhone = toOptionalTrimmedString(input.from_phone) ?? null;
    const fromAddress = toOptionalTrimmedString(input.from_address) ?? null;
    const fromWardName = toOptionalTrimmedString(input.from_ward_name) ?? null;
    const fromDistrictName = toOptionalTrimmedString(input.from_district_name) ?? null;
    const fromProvinceName = toOptionalTrimmedString(input.from_province_name) ?? null;
    const returnPhone = toOptionalTrimmedString(input.return_phone) ?? null;
    const returnAddress = toOptionalTrimmedString(input.return_address) ?? null;
    const returnDistrictId =
      input.return_district_id === null || input.return_district_id === undefined
        ? null
        : parseOptionalPositiveInt(input.return_district_id, "return_district_id") ?? null;
    const returnWardCode = toOptionalTrimmedString(input.return_ward_code) ?? null;
    const toWardCode = toOptionalTrimmedString(input.to_ward_code) ?? null;
    const toDistrictId =
      input.to_district_id === null || input.to_district_id === undefined
        ? null
        : parseOptionalPositiveInt(input.to_district_id, "to_district_id") ?? null;
    const codAmount = parseDecimal(input.cod_amount, "cod_amount", 0);
    const content = toOptionalTrimmedString(input.content) ?? null;
    const weight = parseOptionalNonNegativeInt(input.weight, "weight") ?? null;
    const length = parseOptionalNonNegativeInt(input.length, "length") ?? null;
    const width = parseOptionalNonNegativeInt(input.width, "width") ?? null;
    const height = parseOptionalNonNegativeInt(input.height, "height") ?? null;
    const insuranceValue = parseDecimal(input.insurance_value, "insurance_value", 0);
    const serviceId =
      input.service_id === null || input.service_id === undefined
        ? null
        : parseOptionalNonNegativeInt(input.service_id, "service_id") ?? null;
    const serviceTypeId =
      input.service_type_id === null || input.service_type_id === undefined
        ? null
        : parseOptionalNonNegativeInt(input.service_type_id, "service_type_id") ?? null;
    const pickStationId =
      input.pick_station_id === null || input.pick_station_id === undefined
        ? null
        : parseOptionalPositiveInt(input.pick_station_id, "pick_station_id") ?? null;
    const deliverStationId =
      input.deliver_station_id === null || input.deliver_station_id === undefined
        ? null
        : parseOptionalPositiveInt(input.deliver_station_id, "deliver_station_id") ?? null;
    const coupon = toOptionalTrimmedString(input.coupon) ?? null;
    const pickShift = parseOptionalIntArray(input.pick_shift, "pick_shift") ?? [];
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
    const normalizedItems = await buildNormalizedItems(storeId, requestedItems);

    if (normalizedItems.length === 0 && processingStatus !== "draft") {
      throw new BadRequestError("order_items must contain at least one item unless the order is a draft");
    }

    const customer = customerId
      ? await prisma.customer.findFirst({
          where: { id: customerId, store_id: storeId },
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
          const resolvedOrderCode = orderCode ?? (await generateNextOrderCode(tx, storeId));

          const existingOrder = await tx.order.findFirst({
            where: { order_code: resolvedOrderCode, store_id: storeId },
            select: { id: true },
          });

          if (existingOrder) {
            throw new BadRequestError(`Order code "${resolvedOrderCode}" already exists`);
          }

          const [fromAddressId, toAddressId, returnAddressId] = await Promise.all([
            resolveOrderAddressId(tx, requestedFromAddressId, input.from_address_detail, "from_address"),
            resolveOrderAddressId(tx, requestedToAddressId, input.to_address_detail, "to_address"),
            resolveOrderAddressId(tx, requestedReturnAddressId, input.return_address_detail, "return_address"),
          ]);

          const order = await tx.order.create({
            data: {
              store_id: storeId,
              order_code: resolvedOrderCode,
              order_type: orderType,
              order_date: orderDate,
              customer_id: customerId,
              customer_code: customerCode,
              customer_name: customerName,
              customer_phone: customerPhone,
              customer_email: customerEmail,
              customer_address: customerAddress,
              client_order_code: clientOrderCode,
              note,
              required_note: requiredNote,
              payment_type_id: paymentTypeId,
              from_address_id: fromAddressId,
              to_address_id: toAddressId,
              return_address_id: returnAddressId,
              from_name: fromName,
              from_phone: fromPhone,
              from_address: fromAddress,
              from_ward_name: fromWardName,
              from_district_name: fromDistrictName,
              from_province_name: fromProvinceName,
              return_phone: returnPhone,
              return_address: returnAddress,
              return_district_id: returnDistrictId,
              return_ward_code: returnWardCode,
              to_ward_code: toWardCode,
              to_district_id: toDistrictId,
              cod_amount: codAmount,
              content,
              weight,
              length,
              width,
              height,
              insurance_value: insuranceValue,
              service_id: serviceId,
              service_type_id: serviceTypeId,
              pick_station_id: pickStationId,
              deliver_station_id: deliverStationId,
              coupon,
              pick_shift: pickShift,
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
            include: orderInclude,
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

  updateOrder: async (storeId: string, id: number, input: UpdateOrderRequestInput) => {
    const existingOrder = await getOrderForMutation(storeId, id);
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
          item_weight: item.item_weight,
          item_length: item.item_length,
          item_width: item.item_width,
          item_height: item.item_height,
          category_level1: item.category_level1 ?? undefined,
        }));
    const normalizedItems = await buildNormalizedItems(storeId, requestedItems);

    if (normalizedItems.length === 0 && processingStatus !== "draft") {
      throw new BadRequestError("order_items must contain at least one item unless the order is a draft");
    }

    const customer = customerId
      ? await prisma.customer.findFirst({
          where: { id: customerId, store_id: storeId },
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
    const clientOrderCode =
      input.client_order_code === undefined
        ? existingOrder.client_order_code
        : toOptionalTrimmedString(input.client_order_code) ?? null;
    const note =
      input.note === undefined ? existingOrder.note : toOptionalTrimmedString(input.note) ?? null;
    const requiredNote =
      input.required_note === undefined
        ? existingOrder.required_note
        : toOptionalTrimmedString(input.required_note) ?? null;
    const paymentTypeId =
      input.payment_type_id === undefined
        ? existingOrder.payment_type_id
        : input.payment_type_id === null
          ? null
          : parseOptionalNonNegativeInt(input.payment_type_id, "payment_type_id") ?? null;
    const requestedFromAddressId =
      input.from_address_detail !== undefined
        ? null
        : input.from_address_id === undefined
        ? existingOrder.from_address_id
        : input.from_address_id === null
          ? null
          : parseOptionalPositiveInt(input.from_address_id, "from_address_id") ?? null;
    const requestedToAddressId =
      input.to_address_detail !== undefined
        ? null
        : input.to_address_id === undefined
        ? existingOrder.to_address_id
        : input.to_address_id === null
          ? null
          : parseOptionalPositiveInt(input.to_address_id, "to_address_id") ?? null;
    const requestedReturnAddressId =
      input.return_address_detail !== undefined
        ? null
        : input.return_address_id === undefined
        ? existingOrder.return_address_id
        : input.return_address_id === null
          ? null
          : parseOptionalPositiveInt(input.return_address_id, "return_address_id") ?? null;
    const fromName =
      input.from_name === undefined ? existingOrder.from_name : toOptionalTrimmedString(input.from_name) ?? null;
    const fromPhone =
      input.from_phone === undefined ? existingOrder.from_phone : toOptionalTrimmedString(input.from_phone) ?? null;
    const fromAddress =
      input.from_address === undefined
        ? existingOrder.from_address
        : toOptionalTrimmedString(input.from_address) ?? null;
    const fromWardName =
      input.from_ward_name === undefined
        ? existingOrder.from_ward_name
        : toOptionalTrimmedString(input.from_ward_name) ?? null;
    const fromDistrictName =
      input.from_district_name === undefined
        ? existingOrder.from_district_name
        : toOptionalTrimmedString(input.from_district_name) ?? null;
    const fromProvinceName =
      input.from_province_name === undefined
        ? existingOrder.from_province_name
        : toOptionalTrimmedString(input.from_province_name) ?? null;
    const returnPhone =
      input.return_phone === undefined
        ? existingOrder.return_phone
        : toOptionalTrimmedString(input.return_phone) ?? null;
    const returnAddress =
      input.return_address === undefined
        ? existingOrder.return_address
        : toOptionalTrimmedString(input.return_address) ?? null;
    const returnDistrictId =
      input.return_district_id === undefined
        ? existingOrder.return_district_id
        : input.return_district_id === null
          ? null
          : parseOptionalPositiveInt(input.return_district_id, "return_district_id") ?? null;
    const returnWardCode =
      input.return_ward_code === undefined
        ? existingOrder.return_ward_code
        : toOptionalTrimmedString(input.return_ward_code) ?? null;
    const toWardCode =
      input.to_ward_code === undefined
        ? existingOrder.to_ward_code
        : toOptionalTrimmedString(input.to_ward_code) ?? null;
    const toDistrictId =
      input.to_district_id === undefined
        ? existingOrder.to_district_id
        : input.to_district_id === null
          ? null
          : parseOptionalPositiveInt(input.to_district_id, "to_district_id") ?? null;
    const codAmount =
      input.cod_amount === undefined ? existingOrder.cod_amount : parseDecimal(input.cod_amount, "cod_amount", 0);
    const content =
      input.content === undefined ? existingOrder.content : toOptionalTrimmedString(input.content) ?? null;
    const weight =
      input.weight === undefined
        ? existingOrder.weight
        : parseOptionalNonNegativeInt(input.weight, "weight") ?? null;
    const length =
      input.length === undefined
        ? existingOrder.length
        : parseOptionalNonNegativeInt(input.length, "length") ?? null;
    const width =
      input.width === undefined
        ? existingOrder.width
        : parseOptionalNonNegativeInt(input.width, "width") ?? null;
    const height =
      input.height === undefined
        ? existingOrder.height
        : parseOptionalNonNegativeInt(input.height, "height") ?? null;
    const insuranceValue =
      input.insurance_value === undefined
        ? existingOrder.insurance_value
        : parseDecimal(input.insurance_value, "insurance_value", 0);
    const serviceId =
      input.service_id === undefined
        ? existingOrder.service_id
        : input.service_id === null
          ? null
          : parseOptionalNonNegativeInt(input.service_id, "service_id") ?? null;
    const serviceTypeId =
      input.service_type_id === undefined
        ? existingOrder.service_type_id
        : input.service_type_id === null
          ? null
          : parseOptionalNonNegativeInt(input.service_type_id, "service_type_id") ?? null;
    const pickStationId =
      input.pick_station_id === undefined
        ? existingOrder.pick_station_id
        : input.pick_station_id === null
          ? null
          : parseOptionalPositiveInt(input.pick_station_id, "pick_station_id") ?? null;
    const deliverStationId =
      input.deliver_station_id === undefined
        ? existingOrder.deliver_station_id
        : input.deliver_station_id === null
          ? null
          : parseOptionalPositiveInt(input.deliver_station_id, "deliver_station_id") ?? null;
    const coupon =
      input.coupon === undefined ? existingOrder.coupon : toOptionalTrimmedString(input.coupon) ?? null;
    const pickShift =
      input.pick_shift === undefined
        ? existingOrder.pick_shift
        : parseOptionalIntArray(input.pick_shift, "pick_shift") ?? [];
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
      const [fromAddressId, toAddressId, returnAddressId] = await Promise.all([
        input.from_address_detail === undefined
          ? resolveOrderAddressId(tx, requestedFromAddressId, undefined, "from_address")
          : resolveOrderAddressId(tx, requestedFromAddressId, input.from_address_detail, "from_address"),
        input.to_address_detail === undefined
          ? resolveOrderAddressId(tx, requestedToAddressId, undefined, "to_address")
          : resolveOrderAddressId(tx, requestedToAddressId, input.to_address_detail, "to_address"),
        input.return_address_detail === undefined
          ? resolveOrderAddressId(tx, requestedReturnAddressId, undefined, "return_address")
          : resolveOrderAddressId(tx, requestedReturnAddressId, input.return_address_detail, "return_address"),
      ]);

      await tx.orderItem.deleteMany({
        where: { order_id: id },
      });

      await tx.orderHistory.create({
        data: {
          order_id: id,
          event_type: "order_updated",
          description: "Cập nhật đơn hàng",
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
          client_order_code: clientOrderCode,
          note,
          required_note: requiredNote,
          payment_type_id: paymentTypeId,
          from_address_id: fromAddressId,
          to_address_id: toAddressId,
          return_address_id: returnAddressId,
          from_name: fromName,
          from_phone: fromPhone,
          from_address: fromAddress,
          from_ward_name: fromWardName,
          from_district_name: fromDistrictName,
          from_province_name: fromProvinceName,
          return_phone: returnPhone,
          return_address: returnAddress,
          return_district_id: returnDistrictId,
          return_ward_code: returnWardCode,
          to_ward_code: toWardCode,
          to_district_id: toDistrictId,
          cod_amount: codAmount,
          content,
          weight,
          length,
          width,
          height,
          insurance_value: insuranceValue,
          service_id: serviceId,
          service_type_id: serviceTypeId,
          pick_station_id: pickStationId,
          deliver_station_id: deliverStationId,
          coupon,
          pick_shift: pickShift,
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
        include: orderInclude,
      });
    });

    return mapOrder(updatedOrder);
  },

  runAction: async (
    storeId: string,
    id: number,
    action: OrderActionName,
    input: OrderActionRequestInput,
  ) => {
    const existingOrder = await getOrderForMutation(storeId, id);
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
        status_timeline: updateOrderStageTimeline(existingOrder.status_timeline, "payment", {
          actor: actorName,
          paid_amount: existingOrder.total_amount.toString(),
          outstanding_amount: "0",
          payment_status: "paid",
        }) as Prisma.InputJsonValue,
      };
      historyEntry = {
        event_type: "payment_updated",
        description: "Đơn hàng đã được thanh toán",
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
        description: "Yêu cầu xuất hóa đơn điện tử",
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
        description: "Hoàn thành đơn hàng",
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
        status_timeline: updateOrderStageTimeline(existingOrder.status_timeline, "cancelled", {
          actor: actorName,
          shipping_status: "cancelled",
          note: note ?? "Order cancelled",
        }) as Prisma.InputJsonValue,
      };
      historyEntry = {
        event_type: "order_cancelled",
        description: "Hủy đơn hàng",
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
        status_timeline: updateOrderStageTimeline(existingOrder.status_timeline, "returned", {
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
