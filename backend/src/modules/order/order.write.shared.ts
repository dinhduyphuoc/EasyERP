import { Prisma } from "../../../generated/prisma/client";
import { BadRequestError } from "@/common";
import type {
  OrderInvoiceSnapshotInput,
  OrderItemRequestInput,
  OrderPaymentStatusInput,
  OrderProcessingStatusInput,
  OrderRequestInput,
  UpdateOrderRequestInput,
} from "./order.types";
import type { OrderForMutation } from "./order.persistence";
import { OrderRepository } from "./order.repository";
import {
  normalizeShippingServiceName,
  parseDecimal,
  parseOptionalDate,
  parseOptionalIntArray,
  parseOptionalNonNegativeInt,
  parseOptionalPositiveInt,
  parseOrderPaymentStatus,
  parseOrderProcessingStatus,
  parseOrderType,
  toOptionalTrimmedString,
} from "./order.helpers";

export type ResolvedOrderWriteInput = {
  orderCode: string | undefined;
  orderDate: Date;
  orderType: ReturnType<typeof parseOrderType>;
  paymentStatus: OrderPaymentStatusInput;
  processingStatus: OrderProcessingStatusInput;
  customerId: number | null;
  clientOrderCode: string | null;
  note: string | null;
  requiredNote: string | null;
  paymentTypeId: number | null;
  requestedFromAddressId: number | null;
  requestedToAddressId: number | null;
  requestedReturnAddressId: number | null;
  fromName: string | null;
  fromPhone: string | null;
  fromAddress: string | null;
  fromWardName: string | null;
  fromDistrictName: string | null;
  fromProvinceName: string | null;
  returnPhone: string | null;
  returnAddress: string | null;
  returnDistrictId: number | null;
  returnWardCode: string | null;
  codAmount: Prisma.Decimal;
  content: string | null;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  insuranceValue: Prisma.Decimal;
  serviceId: number | null;
  serviceTypeId: number | null;
  pickStationId: number | null;
  deliverStationId: number | null;
  coupon: string | null;
  pickShift: number[];
  shippingService: string | null;
  salesChannel: string | null;
  orderNotes: string | null;
  paymentNotes: string | null;
  warehouseStatus: string | null;
  trackingCode: string | null;
  shippingStatus: string | null;
  invoiceCode: string | null;
  createdBy: string;
  confirmedBy: string | null;
};

export const loadOrderCustomer = async (storeId: string, customerId: number | null) => {
  if (!customerId) {
    return null;
  }

  const customer = await OrderRepository.findCustomerFirst({
    where: { id: customerId, store_id: storeId },
    select: {
      id: true,
      client_code: true,
      full_name: true,
      phone: true,
      email: true,
      tax_code: true,
      invoice_profile_json: true,
    },
  });

  if (!customer) {
    throw new BadRequestError("customer_id is invalid");
  }

  return customer;
};

const toInvoiceType = (value: unknown): "b2b" | "b2c" =>
  value === "b2b" || value === "b2c" ? value : "b2c";

const toOptionalObjectRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export const normalizeInvoiceSnapshot = (
  input: OrderInvoiceSnapshotInput | null | undefined,
  fallback?: {
    customerName?: string | null;
    customerPhone?: string | null;
    customerEmail?: string | null;
    customerAddress?: string | null;
    customerTaxCode?: string | null;
    existing?: Record<string, unknown>;
  },
) => {
  const existing = fallback?.existing ?? {};
  const resolvedTaxCode =
    toOptionalTrimmedString(input?.tax_code) ??
    (typeof existing.tax_code === "string" ? existing.tax_code.trim() : undefined) ??
    fallback?.customerTaxCode ??
    "";
  const resolvedBuyerName =
    toOptionalTrimmedString(input?.buyer_name) ??
    (typeof existing.buyer_name === "string" ? existing.buyer_name.trim() : undefined) ??
    fallback?.customerName ??
    "";

  return {
    invoice_type:
      input?.invoice_type !== undefined && input?.invoice_type !== null
        ? toInvoiceType(input.invoice_type)
        : (typeof existing.invoice_type === "string" ? toInvoiceType(existing.invoice_type) : resolvedTaxCode ? "b2b" : "b2c"),
    buyer_name: resolvedBuyerName,
    company_name:
      toOptionalTrimmedString(input?.company_name) ??
      (typeof existing.company_name === "string" ? existing.company_name.trim() : ""),
    tax_code: resolvedTaxCode,
    personal_id:
      toOptionalTrimmedString(input?.personal_id) ??
      (typeof existing.personal_id === "string" ? existing.personal_id.trim() : ""),
    budget_unit_code:
      toOptionalTrimmedString(input?.budget_unit_code) ??
      (typeof existing.budget_unit_code === "string" ? existing.budget_unit_code.trim() : ""),
    email:
      toOptionalTrimmedString(input?.email) ??
      (typeof existing.email === "string" ? existing.email.trim() : undefined) ??
      fallback?.customerEmail ??
      "",
    phone:
      toOptionalTrimmedString(input?.phone) ??
      (typeof existing.phone === "string" ? existing.phone.trim() : undefined) ??
      fallback?.customerPhone ??
      "",
    address_line:
      toOptionalTrimmedString(input?.address_line) ??
      (typeof existing.address_line === "string" ? existing.address_line.trim() : undefined) ??
      fallback?.customerAddress ??
      "",
    note:
      toOptionalTrimmedString(input?.note) ??
      (typeof existing.note === "string" ? existing.note.trim() : ""),
  };
};

export const buildInvoiceSnapshotFromCustomer = (args: {
  input: OrderInvoiceSnapshotInput | null | undefined;
  customer:
    | {
        full_name: string;
        phone: string;
        email: string | null;
        tax_code: string | null;
        invoice_profile_json: unknown;
      }
    | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerAddress: string | null;
}) => {
  const existingProfile = args.customer ? toOptionalObjectRecord(args.customer.invoice_profile_json) : {};

  return normalizeInvoiceSnapshot(args.input, {
    customerName: args.customerName,
    customerPhone: args.customerPhone,
    customerEmail: args.customerEmail ?? args.customer?.email ?? null,
    customerAddress: args.customerAddress,
    customerTaxCode: args.customer?.tax_code ?? null,
    existing: existingProfile,
  });
};

export const ensureCustomerContact = (
  customerName: string | null | undefined,
  customerPhone: string | null | undefined,
): { customerName: string; customerPhone: string } => {
  if (!customerName) {
    throw new BadRequestError("customer_info.name is required");
  }

  if (!customerPhone) {
    throw new BadRequestError("customer_info.phone is required");
  }

  return {
    customerName,
    customerPhone,
  };
};

export const resolveOrderPaymentAmounts = ({
  paymentStatus,
  processingStatus,
  depositAmount,
  paidAmount,
  totalAmount,
}: {
  paymentStatus: OrderPaymentStatusInput;
  processingStatus: OrderProcessingStatusInput;
  depositAmount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
}) => {
  let nextPaidAmount = paidAmount;

  if (paymentStatus === "unpaid" && (depositAmount.gt(0) || nextPaidAmount.gt(0))) {
    throw new BadRequestError("unpaid orders cannot include deposit_amount or paid_amount");
  }

  if (paymentStatus === "deposit") {
    if (depositAmount.lte(0)) {
      throw new BadRequestError("deposit orders must include deposit_amount greater than 0");
    }

    if (depositAmount.gt(totalAmount)) {
      throw new BadRequestError("deposit_amount cannot exceed total_amount");
    }

    if (nextPaidAmount.lt(depositAmount)) {
      nextPaidAmount = depositAmount;
    }
  }

  if (paymentStatus === "paid") {
    nextPaidAmount = totalAmount;
  }

  const outstandingAmount = totalAmount.minus(nextPaidAmount);

  if (outstandingAmount.lt(0)) {
    throw new BadRequestError("paid_amount cannot exceed total_amount");
  }

  if (processingStatus === "completed" && paymentStatus !== "paid") {
    throw new BadRequestError("Only fully paid orders can be moved to completed");
  }

  return {
    paidAmount: nextPaidAmount,
    outstandingAmount,
  };
};

export const buildOrderRuntimeTimeline = ({
  orderDate,
  orderCode,
  createdBy,
  confirmedBy,
  salesChannel,
  paymentStatus,
  subTotal,
  discountAmount,
  vatEnabled,
  taxAmount,
  vatRatePercent,
  pricingVersion,
  depositAmount,
  shippingService,
  shippingFee,
  shippingStatus,
  trackingCode,
  warehouseStatus,
  invoiceCode,
  totalAmount,
  paidAmount,
  outstandingAmount,
}: {
  orderDate: Date;
  orderCode: string | null | undefined;
  createdBy: string;
  confirmedBy: string | null;
  salesChannel: string | null;
  paymentStatus: OrderPaymentStatusInput;
  subTotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  vatEnabled: boolean;
  taxAmount: Prisma.Decimal;
  vatRatePercent: Prisma.Decimal;
  pricingVersion: number;
  depositAmount: Prisma.Decimal;
  shippingService: string | null;
  shippingFee: Prisma.Decimal;
  shippingStatus: string | null;
  trackingCode: string | null;
  warehouseStatus: string | null;
  invoiceCode: string | null;
  totalAmount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  outstandingAmount: Prisma.Decimal;
}) => ({
  created: {
    date: orderDate.toISOString(),
    actor: createdBy,
    order_code: orderCode,
  },
  placed: {
    date: orderDate.toISOString(),
    actor: createdBy,
    sales_channel: salesChannel,
    payment_type: paymentStatus,
    sub_total: subTotal.toString(),
    discount_amount: discountAmount.toString(),
    vat_enabled: vatEnabled,
    tax_amount: taxAmount.toString(),
    vat_rate_percent: vatRatePercent.toString(),
    pricing_version: pricingVersion,
    deposit_amount: depositAmount.toString(),
  },
  delivering: {
    date: orderDate.toISOString(),
    actor: confirmedBy ?? createdBy,
    shipping_service: shippingService,
    shipping_fee: shippingFee.toString(),
    shipping_status: shippingStatus,
    tracking_code: trackingCode,
    warehouse_status: warehouseStatus,
  },
  delivered: {
    date: orderDate.toISOString(),
    actor: confirmedBy ?? createdBy,
    shipping_status: shippingStatus,
    tracking_code: trackingCode,
  },
  completed: {
    date: orderDate.toISOString(),
    actor: confirmedBy ?? createdBy,
    invoice_code: invoiceCode,
    total_amount: totalAmount.toString(),
    paid_amount: paidAmount.toString(),
    outstanding_amount: outstandingAmount.toString(),
  },
});

export const mapPersistedOrderItemsToRequestItems = (
  items: Array<{
    product_id: number | null;
    variant_sku: string | null;
    product_name: string;
    sku: string;
    quantity: number;
    unit_price: Prisma.Decimal;
    discount_amount: Prisma.Decimal;
    notes: string | null;
    item_weight: number | null;
    item_length: number | null;
    item_width: number | null;
    item_height: number | null;
    category_level1: string | null;
  }>,
): OrderItemRequestInput[] =>
  items.map((item) => ({
    spu_id: item.product_id,
    product_id: item.product_id,
    sku_code: item.sku,
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

const resolveOptionalString = (value: unknown) => toOptionalTrimmedString(value) ?? null;

const parseCreateAddressReference = (
  addressId: number | null | undefined,
  addressDetail: OrderRequestInput["from_address_detail"],
  fieldName: "from_address_id" | "to_address_id" | "return_address_id",
) =>
  addressDetail !== undefined
    ? null
    : addressId === null
      ? null
      : parseOptionalPositiveInt(addressId, fieldName) ?? null;

const parseUpdateAddressReference = (
  addressId: number | null | undefined,
  addressDetail: UpdateOrderRequestInput["from_address_detail"],
  existingAddressId: number | null,
  fieldName: "from_address_id" | "to_address_id" | "return_address_id",
) =>
  addressDetail !== undefined
    ? null
    : addressId === undefined
      ? existingAddressId
      : addressId === null
        ? null
        : parseOptionalPositiveInt(addressId, fieldName) ?? null;

export const resolveCreateOrderWriteInput = (input: OrderRequestInput): ResolvedOrderWriteInput => ({
  orderCode: toOptionalTrimmedString(input.order_code),
  orderDate: parseOptionalDate(input.order_date, "order_date") ?? new Date(),
  orderType: parseOrderType(input.order_type),
  paymentStatus: parseOrderPaymentStatus(input.payment_status),
  processingStatus: parseOrderProcessingStatus(input.processing_status),
  customerId:
    input.customer_id === null ? null : parseOptionalPositiveInt(input.customer_id, "customer_id") ?? null,
  clientOrderCode: resolveOptionalString(input.client_order_code),
  note: resolveOptionalString(input.note),
  requiredNote: resolveOptionalString(input.required_note),
  paymentTypeId:
    input.payment_type_id === null
      ? null
      : parseOptionalNonNegativeInt(input.payment_type_id, "payment_type_id") ?? null,
  requestedFromAddressId: parseCreateAddressReference(
    input.from_address_id,
    input.from_address_detail,
    "from_address_id",
  ),
  requestedToAddressId: parseCreateAddressReference(
    input.to_address_id,
    input.to_address_detail,
    "to_address_id",
  ),
  requestedReturnAddressId: parseCreateAddressReference(
    input.return_address_id,
    input.return_address_detail,
    "return_address_id",
  ),
  fromName: resolveOptionalString(input.from_name),
  fromPhone: resolveOptionalString(input.from_phone),
  fromAddress: resolveOptionalString(input.from_address),
  fromWardName: resolveOptionalString(input.from_ward_name),
  fromDistrictName: resolveOptionalString(input.from_district_name),
  fromProvinceName: resolveOptionalString(input.from_province_name),
  returnPhone: resolveOptionalString(input.return_phone),
  returnAddress: resolveOptionalString(input.return_address),
  returnDistrictId:
    input.return_district_id === null
      ? null
      : parseOptionalPositiveInt(input.return_district_id, "return_district_id") ?? null,
  returnWardCode: resolveOptionalString(input.return_ward_code),
  codAmount: parseDecimal(input.cod_amount, "cod_amount", 0),
  content: resolveOptionalString(input.content),
  weight: parseOptionalNonNegativeInt(input.weight, "weight") ?? null,
  length: parseOptionalNonNegativeInt(input.length, "length") ?? null,
  width: parseOptionalNonNegativeInt(input.width, "width") ?? null,
  height: parseOptionalNonNegativeInt(input.height, "height") ?? null,
  insuranceValue: parseDecimal(input.insurance_value, "insurance_value", 0),
  serviceId: input.service_id === null ? null : parseOptionalNonNegativeInt(input.service_id, "service_id") ?? null,
  serviceTypeId:
    input.service_type_id === null
      ? null
      : parseOptionalNonNegativeInt(input.service_type_id, "service_type_id") ?? null,
  pickStationId:
    input.pick_station_id === null
      ? null
      : parseOptionalPositiveInt(input.pick_station_id, "pick_station_id") ?? null,
  deliverStationId:
    input.deliver_station_id === null
      ? null
      : parseOptionalPositiveInt(input.deliver_station_id, "deliver_station_id") ?? null,
  coupon: resolveOptionalString(input.coupon),
  pickShift: parseOptionalIntArray(input.pick_shift, "pick_shift") ?? [],
  shippingService: normalizeShippingServiceName(resolveOptionalString(input.shipping_service)),
  salesChannel: resolveOptionalString(input.sales_channel),
  orderNotes: resolveOptionalString(input.order_notes),
  paymentNotes: resolveOptionalString(input.payment_notes),
  warehouseStatus: resolveOptionalString(input.warehouse_status),
  trackingCode: resolveOptionalString(input.tracking_code),
  shippingStatus: resolveOptionalString(input.shipping_status),
  invoiceCode: resolveOptionalString(input.invoice_code),
  createdBy: toOptionalTrimmedString(input.created_by) ?? "System",
  confirmedBy: resolveOptionalString(input.confirmed_by),
});

export const resolveUpdateOrderWriteInput = (
  input: UpdateOrderRequestInput,
  existingOrder: OrderForMutation,
): ResolvedOrderWriteInput => ({
  orderCode: toOptionalTrimmedString(input.order_code) ?? existingOrder.order_code,
  orderDate: parseOptionalDate(input.order_date, "order_date") ?? existingOrder.order_date,
  orderType: parseOrderType(input.order_type ?? existingOrder.order_type),
  paymentStatus: parseOrderPaymentStatus(input.payment_status ?? existingOrder.payment_status),
  processingStatus: parseOrderProcessingStatus(input.processing_status ?? existingOrder.processing_status),
  customerId:
    input.customer_id === undefined
      ? existingOrder.customer_id
      : input.customer_id === null
        ? null
        : parseOptionalPositiveInt(input.customer_id, "customer_id") ?? null,
  clientOrderCode:
    input.client_order_code === undefined
      ? existingOrder.client_order_code
      : resolveOptionalString(input.client_order_code),
  note: input.note === undefined ? existingOrder.note : resolveOptionalString(input.note),
  requiredNote:
    input.required_note === undefined
      ? existingOrder.required_note
      : resolveOptionalString(input.required_note),
  paymentTypeId:
    input.payment_type_id === undefined
      ? existingOrder.payment_type_id
      : input.payment_type_id === null
        ? null
        : parseOptionalNonNegativeInt(input.payment_type_id, "payment_type_id") ?? null,
  requestedFromAddressId: parseUpdateAddressReference(
    input.from_address_id,
    input.from_address_detail,
    existingOrder.from_address_id,
    "from_address_id",
  ),
  requestedToAddressId: parseUpdateAddressReference(
    input.to_address_id,
    input.to_address_detail,
    existingOrder.to_address_id,
    "to_address_id",
  ),
  requestedReturnAddressId: parseUpdateAddressReference(
    input.return_address_id,
    input.return_address_detail,
    existingOrder.return_address_id,
    "return_address_id",
  ),
  fromName: input.from_name === undefined ? existingOrder.from_name : resolveOptionalString(input.from_name),
  fromPhone: input.from_phone === undefined ? existingOrder.from_phone : resolveOptionalString(input.from_phone),
  fromAddress:
    input.from_address === undefined ? existingOrder.from_address : resolveOptionalString(input.from_address),
  fromWardName:
    input.from_ward_name === undefined ? existingOrder.from_ward_name : resolveOptionalString(input.from_ward_name),
  fromDistrictName:
    input.from_district_name === undefined
      ? existingOrder.from_district_name
      : resolveOptionalString(input.from_district_name),
  fromProvinceName:
    input.from_province_name === undefined
      ? existingOrder.from_province_name
      : resolveOptionalString(input.from_province_name),
  returnPhone:
    input.return_phone === undefined ? existingOrder.return_phone : resolveOptionalString(input.return_phone),
  returnAddress:
    input.return_address === undefined ? existingOrder.return_address : resolveOptionalString(input.return_address),
  returnDistrictId:
    input.return_district_id === undefined
      ? existingOrder.return_district_id
      : input.return_district_id === null
        ? null
        : parseOptionalPositiveInt(input.return_district_id, "return_district_id") ?? null,
  returnWardCode:
    input.return_ward_code === undefined
      ? existingOrder.return_ward_code
      : resolveOptionalString(input.return_ward_code),
  codAmount:
    input.cod_amount === undefined ? existingOrder.cod_amount : parseDecimal(input.cod_amount, "cod_amount", 0),
  content: input.content === undefined ? existingOrder.content : resolveOptionalString(input.content),
  weight:
    input.weight === undefined ? existingOrder.weight : parseOptionalNonNegativeInt(input.weight, "weight") ?? null,
  length:
    input.length === undefined ? existingOrder.length : parseOptionalNonNegativeInt(input.length, "length") ?? null,
  width:
    input.width === undefined ? existingOrder.width : parseOptionalNonNegativeInt(input.width, "width") ?? null,
  height:
    input.height === undefined ? existingOrder.height : parseOptionalNonNegativeInt(input.height, "height") ?? null,
  insuranceValue:
    input.insurance_value === undefined
      ? existingOrder.insurance_value
      : parseDecimal(input.insurance_value, "insurance_value", 0),
  serviceId:
    input.service_id === undefined
      ? existingOrder.service_id
      : input.service_id === null
        ? null
        : parseOptionalNonNegativeInt(input.service_id, "service_id") ?? null,
  serviceTypeId:
    input.service_type_id === undefined
      ? existingOrder.service_type_id
      : input.service_type_id === null
        ? null
        : parseOptionalNonNegativeInt(input.service_type_id, "service_type_id") ?? null,
  pickStationId:
    input.pick_station_id === undefined
      ? existingOrder.pick_station_id
      : input.pick_station_id === null
        ? null
        : parseOptionalPositiveInt(input.pick_station_id, "pick_station_id") ?? null,
  deliverStationId:
    input.deliver_station_id === undefined
      ? existingOrder.deliver_station_id
      : input.deliver_station_id === null
        ? null
        : parseOptionalPositiveInt(input.deliver_station_id, "deliver_station_id") ?? null,
  coupon: input.coupon === undefined ? existingOrder.coupon : resolveOptionalString(input.coupon),
  pickShift:
    input.pick_shift === undefined
      ? existingOrder.pick_shift
      : parseOptionalIntArray(input.pick_shift, "pick_shift") ?? [],
  shippingService:
    input.shipping_service === undefined
      ? existingOrder.shipping_service
      : normalizeShippingServiceName(resolveOptionalString(input.shipping_service)),
  salesChannel:
    input.sales_channel === undefined ? existingOrder.sales_channel : resolveOptionalString(input.sales_channel),
  orderNotes:
    input.order_notes === undefined ? existingOrder.order_notes : resolveOptionalString(input.order_notes),
  paymentNotes:
    input.payment_notes === undefined ? existingOrder.payment_notes : resolveOptionalString(input.payment_notes),
  warehouseStatus:
    input.warehouse_status === undefined
      ? existingOrder.warehouse_status
      : resolveOptionalString(input.warehouse_status),
  trackingCode:
    input.tracking_code === undefined ? existingOrder.tracking_code : resolveOptionalString(input.tracking_code),
  shippingStatus:
    input.shipping_status === undefined
      ? existingOrder.shipping_status
      : resolveOptionalString(input.shipping_status),
  invoiceCode:
    input.invoice_code === undefined ? existingOrder.invoice_code : resolveOptionalString(input.invoice_code),
  createdBy: toOptionalTrimmedString(input.created_by) ?? existingOrder.created_by ?? "System",
  confirmedBy:
    input.confirmed_by === undefined ? existingOrder.confirmed_by : resolveOptionalString(input.confirmed_by),
});

export const buildOrderCreateData = ({
  resolved,
  customerCode,
  customerName,
  customerPhone,
  customerEmail,
  customerAddress,
  subTotal,
  discountAmount,
  vatEnabled,
  taxAmount,
  vatRatePercent,
  vatChangedByUser,
  pricingVersion,
  shippingFee,
  totalAmount,
  depositAmount,
  paidAmount,
  outstandingAmount,
  statusTimeline,
  invoiceSnapshot,
}: {
  resolved: ResolvedOrderWriteInput;
  customerCode: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerAddress: string | null;
  subTotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  vatEnabled: boolean;
  taxAmount: Prisma.Decimal;
  vatRatePercent: Prisma.Decimal;
  vatChangedByUser: boolean;
  pricingVersion: number;
  shippingFee: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  depositAmount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  outstandingAmount: Prisma.Decimal;
  statusTimeline: Prisma.InputJsonValue;
  invoiceSnapshot: Prisma.InputJsonValue;
}): Omit<
  Prisma.OrderUncheckedCreateInput,
  "store_id" | "order_code" | "from_address_id" | "to_address_id" | "return_address_id"
> => ({
  order_type: resolved.orderType,
  order_date: resolved.orderDate,
  customer_id: resolved.customerId,
  customer_code: customerCode,
  customer_name: customerName,
  customer_phone: customerPhone,
  customer_email: customerEmail,
  customer_address: customerAddress,
  client_order_code: resolved.clientOrderCode,
  note: resolved.note,
  required_note: resolved.requiredNote,
  payment_type_id: resolved.paymentTypeId,
  from_name: resolved.fromName,
  from_phone: resolved.fromPhone,
  from_address: resolved.fromAddress,
  from_ward_name: resolved.fromWardName,
  from_district_name: resolved.fromDistrictName,
  from_province_name: resolved.fromProvinceName,
  return_phone: resolved.returnPhone,
  return_address: resolved.returnAddress,
  return_district_id: resolved.returnDistrictId,
  return_ward_code: resolved.returnWardCode,
  cod_amount: resolved.codAmount,
  content: resolved.content,
  weight: resolved.weight,
  length: resolved.length,
  width: resolved.width,
  height: resolved.height,
  insurance_value: resolved.insuranceValue,
  service_id: resolved.serviceId,
  service_type_id: resolved.serviceTypeId,
  pick_station_id: resolved.pickStationId,
  deliver_station_id: resolved.deliverStationId,
  coupon: resolved.coupon,
  pick_shift: resolved.pickShift,
  sub_total: subTotal,
  discount_amount: discountAmount,
  vat_enabled: vatEnabled,
  tax_amount: taxAmount,
  vat_rate_percent: vatRatePercent,
  vat_changed_by_user: vatChangedByUser,
  pricing_version: pricingVersion,
  shipping_fee: shippingFee,
  total_amount: totalAmount,
  deposit_amount: depositAmount,
  paid_amount: paidAmount,
  outstanding_amount: outstandingAmount,
  payment_status: resolved.paymentStatus,
  processing_status: resolved.processingStatus,
  shipping_service: resolved.shippingService,
  sales_channel: resolved.salesChannel,
  order_notes: resolved.orderNotes,
  payment_notes: resolved.paymentNotes,
  warehouse_status: resolved.warehouseStatus,
  tracking_code: resolved.trackingCode,
  shipping_status: resolved.shippingStatus,
  invoice_code: resolved.invoiceCode,
  invoice_snapshot_json: invoiceSnapshot,
  created_by: resolved.createdBy,
  confirmed_by: resolved.confirmedBy,
  status_timeline: statusTimeline,
});

export const buildOrderUpdateData = ({
  resolved,
  customerCode,
  customerName,
  customerPhone,
  customerEmail,
  customerAddress,
  subTotal,
  discountAmount,
  vatEnabled,
  taxAmount,
  vatRatePercent,
  vatChangedByUser,
  pricingVersion,
  shippingFee,
  totalAmount,
  depositAmount,
  paidAmount,
  outstandingAmount,
  statusTimeline,
  invoiceSnapshot,
}: {
  resolved: ResolvedOrderWriteInput;
  customerCode: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerAddress: string | null;
  subTotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  vatEnabled: boolean;
  taxAmount: Prisma.Decimal;
  vatRatePercent: Prisma.Decimal;
  vatChangedByUser: boolean;
  pricingVersion: number;
  shippingFee: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  depositAmount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  outstandingAmount: Prisma.Decimal;
  statusTimeline: Prisma.InputJsonValue;
  invoiceSnapshot: Prisma.InputJsonValue;
}): Prisma.OrderUncheckedUpdateInput => ({
  ...buildOrderCreateData({
    resolved,
    customerCode,
    customerName,
    customerPhone,
    customerEmail,
    customerAddress,
    subTotal,
    discountAmount,
    vatEnabled,
    taxAmount,
    vatRatePercent,
    vatChangedByUser,
    pricingVersion,
    shippingFee,
    totalAmount,
    depositAmount,
    paidAmount,
    outstandingAmount,
    statusTimeline,
    invoiceSnapshot,
  }),
});
