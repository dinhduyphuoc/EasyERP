import { Prisma } from "../../../generated/prisma/client";
import { BadRequestError } from "@/common";
import type { OrderRequestInput } from "./order.types";
import { mapOrder } from "./order.mapper";
import { persistCreatedOrder } from "./order.create.persistence";
import {
  type OrderActorContext,
  assertVatEditPermission,
  buildHistoryEntries,
  buildNormalizedItems,
  calculateVatAmount,
  mergeTimeline,
  normalizeOrderPricing,
  parseDecimal,
  toOptionalBoolean,
  toOptionalTrimmedString,
  validateRequestedHistory,
} from "./order.helpers";
import {
  buildInvoiceSnapshotFromCustomer,
  buildOrderCreateData,
  buildOrderRuntimeTimeline,
  ensureCustomerContact,
  loadOrderCustomer,
  resolveCreateOrderWriteInput,
  resolveOrderPaymentAmounts,
} from "./order.write.shared";

export const createOrder = async (
  storeId: string,
  input: OrderRequestInput,
  actor?: OrderActorContext,
) => {
  const resolved = resolveCreateOrderWriteInput(input);
  const normalizedItems = await buildNormalizedItems(storeId, input.order_items ?? []);

  if (normalizedItems.length === 0 && resolved.processingStatus !== "draft") {
    throw new BadRequestError("order_items must contain at least one item unless the order is a draft");
  }

  const customer = await loadOrderCustomer(storeId, resolved.customerId);
  const customerName = toOptionalTrimmedString(input.customer_info?.name) ?? customer?.full_name;
  const customerPhone = toOptionalTrimmedString(input.customer_info?.phone) ?? customer?.phone;
  const customerCode =
    toOptionalTrimmedString(input.customer_info?.customer_code) ?? customer?.client_code ?? null;
  const customerEmail = toOptionalTrimmedString(input.customer_info?.email) ?? null;
  const customerAddress = toOptionalTrimmedString(input.customer_info?.address) ?? null;
  const requiredCustomerContact = ensureCustomerContact(customerName, customerPhone);
  const invoiceSnapshot = buildInvoiceSnapshotFromCustomer({
    input: input.invoice_snapshot,
    customer,
    customerName: requiredCustomerContact.customerName,
    customerPhone: requiredCustomerContact.customerPhone,
    customerEmail,
    customerAddress,
  });

  const requestedVatEnabled = toOptionalBoolean(input.vat_enabled);
  const subTotal =
    normalizedItems.length > 0
      ? normalizedItems.reduce((sum, item) => sum.plus(item.sub_total), new Prisma.Decimal(0))
      : parseDecimal(input.sub_total, "sub_total", 0);
  const vatEnabled = requestedVatEnabled ?? false;
  const effectiveVatRatePercent = vatEnabled
    ? parseDecimal(input.vat_rate_percent, "vat_rate_percent", 0)
    : new Prisma.Decimal(0);
  const taxAmount =
    input.tax_amount !== undefined && input.tax_amount !== null && input.tax_amount !== ""
      ? parseDecimal(input.tax_amount, "tax_amount", 0)
      : calculateVatAmount({
          subTotal,
          vatEnabled,
          vatRatePercent: effectiveVatRatePercent,
        });
  const { discountAmount, shippingFee, totalAmount } = normalizeOrderPricing({
    subTotal,
    discountAmount: parseDecimal(input.discount_amount, "discount_amount", 0),
    taxAmount,
    shippingFee: parseDecimal(input.shipping_fee, "shipping_fee", 0),
  });
  const vatChangedByUser = toOptionalBoolean(input.vat_changed_by_user) ?? false;

  if (vatChangedByUser) {
    assertVatEditPermission(actor);
  }

  if (vatEnabled && effectiveVatRatePercent.gt(0) && taxAmount.lte(0)) {
    throw new BadRequestError("tax_amount must be greater than 0 when vat_rate_percent is enabled");
  }

  const depositAmount = parseDecimal(input.deposit_amount, "deposit_amount", 0);
  const initialPaidAmount = parseDecimal(input.paid_amount, "paid_amount", 0);
  const { paidAmount, outstandingAmount } = resolveOrderPaymentAmounts({
    paymentStatus: resolved.paymentStatus,
    processingStatus: resolved.processingStatus,
    depositAmount,
    paidAmount: initialPaidAmount,
    totalAmount,
  });

  const requestedHistory = validateRequestedHistory(input.order_history);
  const runtimeTimeline = buildOrderRuntimeTimeline({
    orderDate: resolved.orderDate,
    orderCode: resolved.orderCode,
    createdBy: resolved.createdBy,
    confirmedBy: resolved.confirmedBy,
    salesChannel: resolved.salesChannel,
    paymentStatus: resolved.paymentStatus,
    subTotal,
    discountAmount,
    vatEnabled,
    taxAmount,
    vatRatePercent: effectiveVatRatePercent,
    pricingVersion: 1,
    depositAmount,
    shippingService: resolved.shippingService,
    shippingFee,
    shippingStatus: resolved.shippingStatus,
    trackingCode: resolved.trackingCode,
    warehouseStatus: resolved.warehouseStatus,
    invoiceCode: resolved.invoiceCode,
    totalAmount,
    paidAmount,
    outstandingAmount,
  });
  const statusTimeline = mergeTimeline(input.status_timeline, runtimeTimeline);
  const historyEntries = buildHistoryEntries({
    paymentStatus: resolved.paymentStatus,
    processingStatus: resolved.processingStatus,
    salesChannel: resolved.salesChannel,
    createdBy: resolved.createdBy,
    shippingService: resolved.shippingService,
    trackingCode: resolved.trackingCode,
    orderNotes: resolved.orderNotes,
    depositAmount,
    paidAmount,
    totalAmount,
    requestedHistory,
  });

  const createdOrder = await persistCreatedOrder({
    storeId,
    orderCode: resolved.orderCode,
    requestedFromAddressId: resolved.requestedFromAddressId,
    requestedToAddressId: resolved.requestedToAddressId,
    requestedReturnAddressId: resolved.requestedReturnAddressId,
    fromAddressDetail: input.from_address_detail,
    toAddressDetail: input.to_address_detail,
    returnAddressDetail: input.return_address_detail,
    orderData: buildOrderCreateData({
      resolved,
      customerCode,
      customerName: requiredCustomerContact.customerName,
      customerPhone: requiredCustomerContact.customerPhone,
      customerEmail,
      customerAddress,
      subTotal,
      discountAmount,
      vatEnabled,
      taxAmount,
      vatRatePercent: effectiveVatRatePercent,
      vatChangedByUser,
      pricingVersion: 1,
      shippingFee,
      totalAmount,
      depositAmount,
      paidAmount,
      outstandingAmount,
      statusTimeline: statusTimeline as Prisma.InputJsonValue,
      invoiceSnapshot: invoiceSnapshot as Prisma.InputJsonValue,
    }),
    normalizedItems,
    historyEntries,
    createdBy: resolved.createdBy,
  });

  return mapOrder(createdOrder);
};
