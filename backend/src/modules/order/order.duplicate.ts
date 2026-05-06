import type { DuplicateOrderRequestInput } from "./order.types";
import { createOrder } from "./order.commands";
import { getOrderForMutation } from "./order.persistence";
import type { OrderActorContext } from "./order.helpers";
import {
  getCompatibleOrderPricing,
  getStoredVatEnabled,
  parseOptionalDate,
  toOptionalTrimmedString,
} from "./order.helpers";

export const duplicateOrder = async (
  storeId: string,
  id: number,
  input: DuplicateOrderRequestInput = {},
  actor?: OrderActorContext,
) => {
  const existingOrder = await getOrderForMutation(storeId, id);
  const compatiblePricing = getCompatibleOrderPricing({
    discountAmount: existingOrder.discount_amount,
    taxAmount: existingOrder.tax_amount,
    vatRatePercent: existingOrder.vat_rate_percent,
  });
  const actorName = toOptionalTrimmedString(input.actor_name) ?? "System";
  const duplicatedOrderDate = parseOptionalDate(input.order_date, "order_date")?.toISOString();

  return createOrder(
    storeId,
    {
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
      discount_amount: compatiblePricing.discountAmount.toString(),
      vat_enabled: getStoredVatEnabled(existingOrder),
      tax_amount: compatiblePricing.taxAmount.toString(),
      vat_rate_percent: compatiblePricing.vatRatePercent.toString(),
      vat_changed_by_user: existingOrder.vat_changed_by_user,
      pricing_version: 1,
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
      invoice_snapshot:
        existingOrder.invoice_snapshot_json &&
        typeof existingOrder.invoice_snapshot_json === "object" &&
        !Array.isArray(existingOrder.invoice_snapshot_json)
          ? (existingOrder.invoice_snapshot_json as Record<string, unknown>)
          : undefined,
      created_by: actorName,
      confirmed_by: null,
      status_timeline: {},
      order_history: [
        {
          event_type: "order_duplicated",
          description: `Tao ban sao tu don ${existingOrder.order_code}`,
          actor_name: actorName,
          metadata: {
            source_order_id: existingOrder.id,
            source_order_code: existingOrder.order_code,
          },
        },
      ],
      order_items: existingOrder.items.map((item) => ({
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
      })),
    },
    actor,
  );
};
