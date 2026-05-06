import { Prisma } from "../../../generated/prisma/client";
import { BadRequestError } from "@/common";
import type { UpdateOrderRequestInput } from "./order.types";
import { mapOrder } from "./order.mapper";
import { getOrderForMutation } from "./order.persistence";
import { persistUpdatedOrder } from "./order.update.persistence";
import {
  type OrderActorContext,
  assertVatEditPermission,
  buildNormalizedItems,
  calculateVatAmount,
  getCompatibleOrderPricing,
  getStoredVatEnabled,
  mergeTimeline,
  normalizeOrderPricing,
  parseDecimal,
  toOptionalBoolean,
  toOptionalTrimmedString,
  writeVatAuditLog,
} from "./order.helpers";
import {
  buildInvoiceSnapshotFromCustomer,
  buildOrderRuntimeTimeline,
  buildOrderUpdateData,
  ensureCustomerContact,
  loadOrderCustomer,
  mapPersistedOrderItemsToRequestItems,
  resolveOrderPaymentAmounts,
  resolveUpdateOrderWriteInput,
} from "./order.write.shared";

export const updateOrder = async (
  storeId: string,
  id: number,
  input: UpdateOrderRequestInput,
  actor?: OrderActorContext,
) => {
  const existingOrder = await getOrderForMutation(storeId, id);

  if (!["draft", "placed"].includes(existingOrder.processing_status)) {
    throw new BadRequestError("Only draft or placed orders can be edited");
  }

  const resolved = resolveUpdateOrderWriteInput(input, existingOrder);
  const compatibleExistingPricing = getCompatibleOrderPricing({
    discountAmount: existingOrder.discount_amount,
    taxAmount: existingOrder.tax_amount,
    vatRatePercent: existingOrder.vat_rate_percent,
  });
  const requestedItems = Array.isArray(input.order_items)
    ? input.order_items
    : mapPersistedOrderItemsToRequestItems(existingOrder.items);
  const normalizedItems = await buildNormalizedItems(storeId, requestedItems);

  if (normalizedItems.length === 0 && resolved.processingStatus !== "draft") {
    throw new BadRequestError("order_items must contain at least one item unless the order is a draft");
  }

  const customer = await loadOrderCustomer(storeId, resolved.customerId);
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
  const requiredCustomerContact = ensureCustomerContact(customerName, customerPhone);
  const existingInvoiceSnapshot =
    existingOrder.invoice_snapshot_json &&
    typeof existingOrder.invoice_snapshot_json === "object" &&
    !Array.isArray(existingOrder.invoice_snapshot_json)
      ? (existingOrder.invoice_snapshot_json as Record<string, unknown>)
      : {};
  const invoiceSnapshot = buildInvoiceSnapshotFromCustomer({
    input: input.invoice_snapshot,
    customer,
    customerName: requiredCustomerContact.customerName,
    customerPhone: requiredCustomerContact.customerPhone,
    customerEmail,
    customerAddress,
  });
  const mergedInvoiceSnapshot = {
    ...existingInvoiceSnapshot,
    ...invoiceSnapshot,
  };

  const subTotal = normalizedItems.reduce((sum, item) => sum.plus(item.sub_total), new Prisma.Decimal(0));
  const discountAmountInput =
    input.discount_amount === undefined
      ? compatibleExistingPricing.discountAmount
      : parseDecimal(input.discount_amount, "discount_amount", 0);
  const shippingFeeInput =
    input.shipping_fee === undefined
      ? existingOrder.shipping_fee
      : parseDecimal(input.shipping_fee, "shipping_fee", 0);
  const existingVatEnabled = getStoredVatEnabled(existingOrder);
  const vatChangedRequested =
    input.vat_enabled !== undefined ||
    input.vat_rate_percent !== undefined ||
    input.vat_changed_by_user === true;

  if (vatChangedRequested) {
    assertVatEditPermission(actor);
  }

  const vatEnabled = vatChangedRequested
    ? toOptionalBoolean(input.vat_enabled) ?? existingVatEnabled
    : existingVatEnabled;
  const vatRatePercent = vatChangedRequested
    ? parseDecimal(input.vat_rate_percent ?? compatibleExistingPricing.vatRatePercent, "vat_rate_percent", 0)
    : compatibleExistingPricing.vatRatePercent;
  const taxAmount = vatChangedRequested
    ? calculateVatAmount({
        subTotal,
        vatEnabled,
        vatRatePercent,
      })
    : compatibleExistingPricing.taxAmount;
  const pricingVersion = vatChangedRequested ? existingOrder.pricing_version + 1 : existingOrder.pricing_version;
  const vatChangedByUser = vatChangedRequested ? true : existingOrder.vat_changed_by_user;
  const { discountAmount, shippingFee, totalAmount } = normalizeOrderPricing({
    subTotal,
    discountAmount: discountAmountInput,
    taxAmount,
    shippingFee: shippingFeeInput,
  });
  const depositAmount =
    input.deposit_amount === undefined
      ? existingOrder.deposit_amount
      : parseDecimal(input.deposit_amount, "deposit_amount", 0);
  const requestedPaidAmount =
    input.paid_amount === undefined
      ? existingOrder.paid_amount
      : parseDecimal(input.paid_amount, "paid_amount", 0);
  const { paidAmount, outstandingAmount } = resolveOrderPaymentAmounts({
    paymentStatus: resolved.paymentStatus,
    processingStatus: resolved.processingStatus,
    depositAmount,
    paidAmount: requestedPaidAmount,
    totalAmount,
  });

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
    vatRatePercent,
    pricingVersion,
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
  const statusTimeline = mergeTimeline(
    input.status_timeline ?? (existingOrder.status_timeline as Record<string, unknown>),
    runtimeTimeline,
  );
  const vatAuditFrom = {
    vatEnabled: existingVatEnabled,
    vatRatePercent: compatibleExistingPricing.vatRatePercent.toString(),
    taxAmount: compatibleExistingPricing.taxAmount.toString(),
  };
  const vatAuditTo = {
    vatEnabled,
    vatRatePercent: vatRatePercent.toString(),
    taxAmount: taxAmount.toString(),
  };
  const vatHistoryActorName = actor?.fullName ?? resolved.createdBy;

  const updatedOrder = await persistUpdatedOrder({
    id,
    existingItems: existingOrder.items,
    requestedFromAddressId: resolved.requestedFromAddressId,
    requestedToAddressId: resolved.requestedToAddressId,
    requestedReturnAddressId: resolved.requestedReturnAddressId,
    fromAddressDetail: input.from_address_detail,
    toAddressDetail: input.to_address_detail,
    returnAddressDetail: input.return_address_detail,
    createHistoryData: {
      order: { connect: { id } },
      event_type: "order_updated",
      description: "Cáº­p nháº­t Ä‘Æ¡n hÃ ng",
      actor_name: resolved.createdBy,
      metadata: {
        payment_status: resolved.paymentStatus,
        processing_status: resolved.processingStatus,
        discount_amount: discountAmount.toString(),
        vat_enabled: vatEnabled,
        tax_amount: taxAmount.toString(),
        vat_rate_percent: vatRatePercent.toString(),
        pricing_version: pricingVersion,
        total_amount: totalAmount.toString(),
        item_count: normalizedItems.length,
      },
    },
    createVatHistoryData: vatChangedRequested
      ? {
          order: { connect: { id } },
          event_type: "vat_change",
          description: "Cáº­p nháº­t cáº¥u hÃ¬nh VAT cá»§a Ä‘Æ¡n hÃ ng",
          actor_name: vatHistoryActorName,
          metadata: {
            type: "vat_change",
            old_vat_enabled: vatAuditFrom.vatEnabled,
            new_vat_enabled: vatAuditTo.vatEnabled,
            old_vat_rate: vatAuditFrom.vatRatePercent,
            new_vat_rate: vatAuditTo.vatRatePercent,
            old_tax_amount: vatAuditFrom.taxAmount,
            new_tax_amount: vatAuditTo.taxAmount,
            changed_by: actor?.userId ?? null,
            changed_at: new Date().toISOString(),
            pricing_version: pricingVersion,
          },
        }
      : undefined,
    updateData: buildOrderUpdateData({
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
      vatRatePercent,
      vatChangedByUser,
      pricingVersion,
      shippingFee,
      totalAmount,
      depositAmount,
      paidAmount,
      outstandingAmount,
      statusTimeline: statusTimeline as Prisma.InputJsonValue,
      invoiceSnapshot: mergedInvoiceSnapshot as Prisma.InputJsonValue,
    }),
    normalizedItems,
  });

  if (vatChangedRequested) {
    await writeVatAuditLog({
      actor,
      orderId: updatedOrder.id,
      orderCode: updatedOrder.order_code,
      from: vatAuditFrom,
      to: vatAuditTo,
      pricingVersion,
    });
  }

  return mapOrder(updatedOrder);
};
