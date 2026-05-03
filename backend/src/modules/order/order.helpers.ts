import { Prisma } from "../../../generated/prisma/client";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/common";
import { AuditLogService } from "@/common/services/audit-log.service";
import type {
  OrderHistoryInput,
  OrderItemRequestInput,
  OrderListQuery,
  OrderPaymentStatusInput,
  OrderProcessingStatusInput,
  OrderTypeInput,
} from "./order.types";
import { OrderRepository } from "./order.repository";

export type OrderActorContext = {
  userId: string;
  tenantId: string | null;
  fullName: string;
  permissions: string[];
};

export const ORDER_CODE_PREFIX = "DH";
export const ORDER_CODE_NUMBER_LENGTH = 4;
export const ORDER_CODE_GENERATION_RETRIES = 5;
export const ORDER_PAYMENT_STATUSES: OrderPaymentStatusInput[] = ["unpaid", "paid", "deposit"];
export const ORDER_PAYMENT_COLLECTION_METHODS = ["bank_transfer", "cash", "cod", "card"] as const;
export const ORDER_PROCESSING_STATUSES: OrderProcessingStatusInput[] = [
  "draft",
  "placed",
  "delivering",
  "delivered",
  "completed",
  "cancelled",
  "returned",
];
export const ORDER_TYPES: OrderTypeInput[] = ["sale", "return"];
export const ORDER_VAT_UPDATE_PERMISSION = "orders.vat.update";
export const DEFAULT_GHN_REQUIRED_NOTE = "KHONGCHOXEMHANG";
export const DEFAULT_GHN_PAYMENT_TYPE_ID = 1;
export const DEFAULT_GHN_WEIGHT = 500;
export const DEFAULT_GHN_LENGTH = 20;
export const DEFAULT_GHN_WIDTH = 15;
export const DEFAULT_GHN_HEIGHT = 10;

export const orderProcessingStatusLabels = {
  draft: "Nháp",
  placed: "Mới",
  delivering: "Đang giao",
  delivered: "Đã giao",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
  returned: "Trả hàng",
} satisfies Record<OrderProcessingStatusInput, string>;

export const processingStatusPresentation: Record<
  OrderProcessingStatusInput,
  { label: string; description: string }
> = {
  draft: {
    label: "Nháp",
    description: "Đơn nháp chờ xác nhận và bổ sung thông tin.",
  },
  placed: {
    label: "Mới",
    description: "Đơn hàng mới tạo, sẵn sàng để lên đơn vận chuyển.",
  },
  delivering: {
    label: "Đang giao",
    description: "Đơn đang trong quá trình giao đến khách hàng.",
  },
  delivered: {
    label: "Đã giao",
    description: "Đơn hàng đã giao thành công cho khách nhưng chưa kết thúc nghiệp vụ.",
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

export const defaultPaymentStatusDescriptions = {
  unpaid:
    "Chưa có giao dịch thanh toán. Có thể lưu nhập hoặc chờ xác nhận, nhưng không được hoàn thành đơn.",
  paid:
    "Đã thu đủ tiền cho đơn hàng. Có thể tiếp tục reserve kho, giao vận và kết thúc đơn.",
  deposit:
    "Đã thu tiền cọc một phần. Đơn vẫn được xử lý tiếp nhưng cần thu nốt trước khi completed.",
} satisfies Record<OrderPaymentStatusInput, string>;

export const defaultProcessingStatusDescriptions = {
  draft: "Đơn nháp chờ duyệt nội bộ hoặc bổ sung thông tin.",
  placed: "Đơn hàng mới tạo và chưa được đẩy sang đơn vị vận chuyển.",
  delivering: "Đơn hàng đang trong quá trình giao cho khách.",
  delivered: "Đơn hàng đã giao cho khách và chưa hoàn tất nghiệp vụ thanh toán.",
  completed: "Đơn hàng hoàn tất, đã đối soát thanh toán và chứng từ.",
  cancelled: "Đơn hàng đã bị hủy trước khi hoàn tất.",
  returned: "Đơn hàng trả về hoặc hoàn trả từ khách.",
} satisfies Record<OrderProcessingStatusInput, string>;

export const defaultTimelineTemplate = {
  created: {
    stage: "Đã tạo",
    date: null,
    actor: null,
    order_code: null,
  },
  placed: {
    stage: "Mới",
    date: null,
    actor: null,
    sales_channel: null,
    payment_type: null,
    sub_total: null,
    deposit_amount: null,
  },
  delivering: {
    stage: "Đang giao",
    date: null,
    actor: null,
    shipping_service: null,
    tracking_code: null,
    shipping_fee: null,
    shipping_status: null,
    warehouse_status: null,
    note: null,
  },
  delivered: {
    stage: "Đã giao",
    date: null,
    actor: null,
    shipping_status: null,
    tracking_code: null,
    note: null,
  },
  completed: {
    stage: "Hoàn thành",
    date: null,
    actor: null,
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

export const toOptionalTrimmedString = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const normalizeShippingServiceName = (value: string | null | undefined) => {
  if (!value) {
    return value ?? null;
  }

  const [providerName] = value.split(" - ");
  const normalized = providerName.trim();
  return normalized.length > 0 ? normalized : value;
};

export const toOptionalBoolean = (value: unknown) => {
  if (typeof value === "boolean") {
    return value;
  }

  return undefined;
};

export const calculateVatAmount = ({
  subTotal,
  vatEnabled,
  vatRatePercent,
}: {
  subTotal: Prisma.Decimal;
  vatEnabled: boolean;
  vatRatePercent: Prisma.Decimal;
}) => {
  if (!vatEnabled || vatRatePercent.lte(0) || subTotal.lte(0)) {
    return new Prisma.Decimal(0);
  }

  return subTotal.mul(vatRatePercent).div(100);
};

export const assertVatEditPermission = (actor: OrderActorContext | undefined) => {
  if (!actor?.permissions.includes(ORDER_VAT_UPDATE_PERMISSION)) {
    throw new ForbiddenError("You do not have permission to change VAT settings for orders", {
      required_permission: ORDER_VAT_UPDATE_PERMISSION,
    });
  }
};

export const parseOptionalPositiveInt = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BadRequestError(`${fieldName} must be a positive integer`);
  }

  return parsed;
};

export const parseRequiredPositiveInt = (value: unknown, fieldName: string) => {
  const parsed = parseOptionalPositiveInt(value, fieldName);

  if (!parsed) {
    throw new BadRequestError(`${fieldName} is required`);
  }

  return parsed;
};

export const parseOptionalNonNegativeInt = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new BadRequestError(`${fieldName} must be a non-negative integer`);
  }

  return parsed;
};

export const parseOptionalIntArray = (value: unknown, fieldName: string) => {
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

export const parseOptionalDate = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestError(`${fieldName} must be a valid date`);
  }

  return date;
};

export const parseDecimal = (value: unknown, fieldName: string, defaultValue = 0) => {
  if (value === undefined || value === null || value === "") {
    return new Prisma.Decimal(defaultValue);
  }

  try {
    return new Prisma.Decimal(value as string | number | Prisma.Decimal);
  } catch {
    throw new BadRequestError(`${fieldName} must be a valid number`);
  }
};

export const parseDecimalOrNull = (value: unknown, fieldName: string) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  try {
    return new Prisma.Decimal(value as string | number | Prisma.Decimal);
  } catch {
    throw new BadRequestError(`${fieldName} must be a valid number`);
  }
};

export const ensureNonNegativeDecimal = (value: Prisma.Decimal, fieldName: string) => {
  if (value.lt(0)) {
    throw new BadRequestError(`${fieldName} must be a non-negative number`);
  }

  return value;
};

export const normalizeOrderPricing = ({
  subTotal,
  discountAmount,
  taxAmount,
  shippingFee,
}: {
  subTotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  shippingFee: Prisma.Decimal;
}) => {
  const nextDiscountAmount = ensureNonNegativeDecimal(discountAmount, "discount_amount");
  const nextTaxAmount = ensureNonNegativeDecimal(taxAmount, "tax_amount");
  const nextShippingFee = ensureNonNegativeDecimal(shippingFee, "shipping_fee");

  if (nextDiscountAmount.gt(subTotal)) {
    throw new BadRequestError("discount_amount cannot exceed sub_total");
  }

  const totalAmount = subTotal.minus(nextDiscountAmount).plus(nextTaxAmount).plus(nextShippingFee);

  if (totalAmount.lt(0)) {
    throw new BadRequestError("total_amount cannot be negative");
  }

  return {
    discountAmount: nextDiscountAmount,
    taxAmount: nextTaxAmount,
    shippingFee: nextShippingFee,
    totalAmount,
  };
};

export const getCompatibleOrderPricing = ({
  discountAmount,
  taxAmount,
  vatRatePercent,
}: {
  discountAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  vatRatePercent: Prisma.Decimal;
}) => {
  const isLegacyDiscountStoredInTax =
    vatRatePercent.lte(0) && discountAmount.lte(0) && taxAmount.gt(0);

  if (isLegacyDiscountStoredInTax) {
    return {
      discountAmount: taxAmount,
      taxAmount: new Prisma.Decimal(0),
      vatRatePercent: new Prisma.Decimal(0),
    };
  }

  return {
    discountAmount,
    taxAmount,
    vatRatePercent,
  };
};

export const getStoredVatEnabled = (order: {
  vat_enabled?: boolean;
  vat_rate_percent: Prisma.Decimal;
  tax_amount: Prisma.Decimal;
}) => order.vat_enabled || order.vat_rate_percent.gt(0) || order.tax_amount.gt(0);

export const parseOrderPaymentStatus = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return "unpaid" as const;
  }

  if (typeof value === "string" && ORDER_PAYMENT_STATUSES.includes(value as OrderPaymentStatusInput)) {
    return value as OrderPaymentStatusInput;
  }

  throw new BadRequestError(`payment_status must be one of: ${ORDER_PAYMENT_STATUSES.join(", ")}`);
};

export const parsePaymentCollectionMethod = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return "bank_transfer" as const;
  }

  if (
    typeof value === "string" &&
    ORDER_PAYMENT_COLLECTION_METHODS.includes(
      value as (typeof ORDER_PAYMENT_COLLECTION_METHODS)[number],
    )
  ) {
    return value as (typeof ORDER_PAYMENT_COLLECTION_METHODS)[number];
  }

  throw new BadRequestError(
    `payment_method must be one of: ${ORDER_PAYMENT_COLLECTION_METHODS.join(", ")}`,
  );
};

export const parseOrderProcessingStatus = (value: unknown) => {
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

export const parseOrderType = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return "sale" as const;
  }

  if (typeof value === "string" && ORDER_TYPES.includes(value as OrderTypeInput)) {
    return value as OrderTypeInput;
  }

  throw new BadRequestError(`order_type must be one of: ${ORDER_TYPES.join(", ")}`);
};

export const decimalToString = (value: Prisma.Decimal | null | undefined) => {
  if (!value) {
    return "0";
  }

  return value.toString();
};

export const decimalToNullableString = (value: Prisma.Decimal | null | undefined) => {
  if (!value) {
    return null;
  }

  return value.toString();
};

export const mergeTimeline = (
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

export const updateOrderStageTimeline = (
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

export const generateInvoiceCode = (orderCode: string) => {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `EINV-${stamp}-${orderCode}`;
};

export const writeVatAuditLog = async ({
  actor,
  orderId,
  orderCode,
  from,
  to,
  pricingVersion,
}: {
  actor: OrderActorContext | undefined;
  orderId: number;
  orderCode: string;
  from: { vatEnabled: boolean; vatRatePercent: string; taxAmount: string };
  to: { vatEnabled: boolean; vatRatePercent: string; taxAmount: string };
  pricingVersion: number;
}) => {
  if (!actor?.userId) {
    return;
  }

  await AuditLogService.write({
    tenant_id: actor.tenantId,
    actor_user_id: actor.userId,
    action: "UPDATE_VAT",
    resource_type: "order",
    resource_id: String(orderId),
    status: "success",
    metadata_json: {
      order_code: orderCode,
      from: {
        vat_enabled: from.vatEnabled,
        vat_rate_percent: from.vatRatePercent,
        tax_amount: from.taxAmount,
      },
      to: {
        vat_enabled: to.vatEnabled,
        vat_rate_percent: to.vatRatePercent,
        tax_amount: to.taxAmount,
      },
      pricing_version: pricingVersion,
    },
  });
};

export const toProviderRequestError = (
  error: unknown,
  fallbackMessage: string,
) => {
  if (error instanceof BadRequestError || error instanceof NotFoundError) {
    return error;
  }

  const message =
    error instanceof Error && error.message.trim()
      ? error.message
      : fallbackMessage;

  return new BadRequestError(message);
};

export const buildWhereClause = (storeId: string, query: OrderListQuery): Prisma.OrderWhereInput => {
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

export const validateRequestedHistory = (items: OrderHistoryInput[] | undefined) => {
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

export const buildHistoryEntries = (input: {
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
      description: "Khách hàng đặt cọc",
      actor_name: input.createdBy,
      metadata: {
        payment_status: input.paymentStatus,
        payment_amount: input.paidAmount.toString(),
        paid_amount: input.paidAmount.toString(),
        deposit_amount: input.depositAmount.toString(),
        outstanding_amount: input.totalAmount.minus(input.paidAmount).toString(),
        payment_label: "Đặt cọc",
      },
    });
  }

  if (input.paymentStatus === "paid") {
    baseEntries.push({
      event_type: "payment_updated",
      description: "Đơn hàng đã được thanh toán",
      actor_name: input.createdBy,
      metadata: {
        payment_amount: input.paidAmount.toString(),
        payment_status: input.paymentStatus,
        paid_amount: input.paidAmount.toString(),
        outstanding_amount: "0",
        payment_label: "Thanh toán đủ",
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

export const buildNormalizedItems = async (storeId: string, items: OrderItemRequestInput[]) => {
  const requestedVariantSkus = items
    .map((item) => toOptionalTrimmedString(item.variant_sku))
    .filter((value): value is string => Boolean(value));
  const requestedProductIds = items
    .map((item) => (item.product_id === null ? undefined : parseOptionalPositiveInt(item.product_id, "product_id")))
    .filter((value): value is number => Boolean(value));

  const [variants, products] = await Promise.all([
    requestedVariantSkus.length > 0
      ? OrderRepository.findProductVariants({
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
      ? OrderRepository.findProducts({
          where: { id: { in: requestedProductIds }, store_id: storeId },
          select: {
            id: true,
            product_name: true,
            default_variant_sku: true,
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
    const sku =
      toOptionalTrimmedString(item.sku) ??
      variantSku ??
      product?.default_variant_sku ??
      undefined;

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
