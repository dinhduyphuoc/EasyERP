import { Prisma } from "../../../generated/prisma/client";
import {
  decimalToString,
  getCompatibleOrderPricing,
  getStoredVatEnabled,
} from "./order.helpers";
import type { OrderForEdit, OrderWithRelations } from "./order.persistence";

type OrderListRow = {
  id: number;
  order_code: string;
  order_type: string;
  order_date: Date;
  customer_id: number | null;
  customer_code: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  customer_address: string | null;
  sub_total: Prisma.Decimal;
  discount_amount: Prisma.Decimal;
  shipping_fee: Prisma.Decimal;
  total_amount: Prisma.Decimal;
  deposit_amount: Prisma.Decimal;
  paid_amount: Prisma.Decimal;
  outstanding_amount: Prisma.Decimal;
  payment_status: string;
  processing_status: string;
  shipping_service: string | null;
  sales_channel: string | null;
  warehouse_status: string | null;
  tracking_code: string | null;
  shipping_status: string | null;
  invoice_code: string | null;
  invoice_snapshot_json: Prisma.JsonValue;
  created_by: string | null;
  confirmed_by: string | null;
  created_at: Date;
  updated_at: Date;
};

const buildOrderItemDisplay = (input: {
  product_name: string;
  sku: string;
  variant?: {
    sku: string;
    attribute_values: Array<{
      attribute_value: {
        value: string;
      };
    }>;
  } | null;
}) => {
  const optionLabel = input.variant?.attribute_values
    .map((item) => item.attribute_value.value)
    .filter(Boolean)
    .join(" / ");

  return {
    variant_label: optionLabel || input.variant?.sku || input.sku,
    display_name: optionLabel ? `${input.product_name} - ${optionLabel}` : input.product_name,
  };
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
  product?: {
    image_url: string | null;
  } | null;
  variant?: {
    image_url: string | null;
    sku: string;
    attribute_values: Array<{
      attribute_value: {
        value: string;
      };
    }>;
  } | null;
}) => {
  const display = buildOrderItemDisplay({
    product_name: item.product_name,
    sku: item.sku,
    variant: item.variant,
  });

  return {
    id: item.id,
    spu_id: item.product_id,
    product_id: item.product_id,
    sku_code: item.sku,
    variant_sku: item.variant_sku,
    product_name: item.product_name,
    display_name: display.display_name,
    variant_label: display.variant_label,
    sku: item.sku,
    quantity: item.quantity,
    unit_price: decimalToString(item.unit_price),
    discount_amount: decimalToString(item.discount_amount),
    sub_total: decimalToString(item.sub_total),
    notes: item.notes,
    image_url: item.variant?.image_url ?? item.product?.image_url ?? null,
  };
};

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

export const mapOrderHistoryEntry = mapOrderHistory;

const mapInvoiceSnapshot = (value: Prisma.JsonValue) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      invoice_type: "b2c",
      buyer_name: "",
      company_name: "",
      tax_code: "",
      personal_id: "",
      budget_unit_code: "",
      email: "",
      phone: "",
      address_line: "",
      note: "",
    };
  }

  const source = value as Record<string, unknown>;

  return {
    invoice_type: source.invoice_type === "b2b" ? "b2b" : "b2c",
    buyer_name: typeof source.buyer_name === "string" ? source.buyer_name : "",
    company_name: typeof source.company_name === "string" ? source.company_name : "",
    tax_code: typeof source.tax_code === "string" ? source.tax_code : "",
    personal_id: typeof source.personal_id === "string" ? source.personal_id : "",
    budget_unit_code: typeof source.budget_unit_code === "string" ? source.budget_unit_code : "",
    email: typeof source.email === "string" ? source.email : "",
    phone: typeof source.phone === "string" ? source.phone : "",
    address_line: typeof source.address_line === "string" ? source.address_line : "",
    note: typeof source.note === "string" ? source.note : "",
  };
};

const compactTimelineStage = (stage: unknown) => {
  if (!stage || typeof stage !== "object") {
    return null;
  }

  const source = stage as Record<string, unknown>;
  const compacted = Object.fromEntries(
    Object.entries(source).filter(([key, value]) => {
      if (key === "stage") {
        return true;
      }

      if (value === null || value === undefined) {
        return false;
      }

      if (typeof value === "string") {
        return value.trim().length > 0;
      }

      if (Array.isArray(value)) {
        return value.length > 0;
      }

      return true;
    }),
  );

  const hasMeaningfulData = Object.entries(compacted).some(
    ([key, value]) => key !== "stage" && value !== null && value !== undefined,
  );

  if (!hasMeaningfulData) {
    return null;
  }

  return compacted;
};

const compactTimeline = (timeline: Prisma.JsonValue) => {
  if (!timeline || typeof timeline !== "object" || Array.isArray(timeline)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(timeline as Record<string, unknown>)
      .map(([stage, value]) => [stage, compactTimelineStage(value)])
      .filter((entry): entry is [string, Record<string, unknown>] => Boolean(entry[1])),
  );
};

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

const buildBaseOrderPayload = (order: {
  id: number;
  order_code: string;
  order_type: string;
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
  from_address_detail: Parameters<typeof mapAddress>[0];
  to_address_detail: Parameters<typeof mapAddress>[0];
  return_address_detail: Parameters<typeof mapAddress>[0];
  from_name: string | null;
  from_phone: string | null;
  from_address: string | null;
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
  discount_amount: Prisma.Decimal;
  tax_amount: Prisma.Decimal;
  vat_rate_percent: Prisma.Decimal;
  vat_changed_by_user: boolean;
  pricing_version: number;
  shipping_fee: Prisma.Decimal;
  total_amount: Prisma.Decimal;
  deposit_amount: Prisma.Decimal;
  paid_amount: Prisma.Decimal;
  outstanding_amount: Prisma.Decimal;
  payment_status: string;
  processing_status: string;
  shipping_service: string | null;
  sales_channel: string | null;
  order_notes: string | null;
  payment_notes: string | null;
  warehouse_status: string | null;
  tracking_code: string | null;
  shipping_status: string | null;
  invoice_code: string | null;
  invoice_snapshot_json: Prisma.JsonValue;
  created_by: string | null;
  confirmed_by: string | null;
  status_timeline: Prisma.JsonValue;
  created_at: Date;
  updated_at: Date;
  items?: Array<Parameters<typeof mapOrderItem>[0]>;
}) => {
  const compatiblePricing = getCompatibleOrderPricing({
    discountAmount: order.discount_amount,
    taxAmount: order.tax_amount,
    vatRatePercent: order.vat_rate_percent,
  });
  const vatEnabled = getStoredVatEnabled(order);

  return {
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
    discount_amount: decimalToString(compatiblePricing.discountAmount),
    vat_enabled: vatEnabled,
    tax_amount: decimalToString(compatiblePricing.taxAmount),
    vat_rate_percent: decimalToString(compatiblePricing.vatRatePercent),
    vat_changed_by_user: order.vat_changed_by_user,
    pricing_version: order.pricing_version,
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
    invoice_snapshot: mapInvoiceSnapshot(order.invoice_snapshot_json),
    created_by: order.created_by,
    confirmed_by: order.confirmed_by,
    status_timeline: compactTimeline(order.status_timeline),
    created_at: order.created_at.toISOString(),
    updated_at: order.updated_at.toISOString(),
    order_items: order.items?.map(mapOrderItem) ?? [],
  };
};

export const mapOrder = (order: OrderWithRelations) => ({
  ...buildBaseOrderPayload(order),
  order_history: order.history?.map(mapOrderHistory) ?? [],
});

export const mapOrderDetail = (order: OrderWithRelations) => mapOrder(order);

export const mapOrderForEdit = (order: OrderForEdit) => buildBaseOrderPayload(order);

export const mapOrderListItem = (order: OrderListRow) => ({
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
  discount_amount: decimalToString(order.discount_amount),
  shipping_fee: decimalToString(order.shipping_fee),
  total_amount: decimalToString(order.total_amount),
  deposit_amount: decimalToString(order.deposit_amount),
  paid_amount: decimalToString(order.paid_amount),
  outstanding_amount: decimalToString(order.outstanding_amount),
  payment_status: order.payment_status,
  processing_status: order.processing_status,
  shipping_service: order.shipping_service,
  sales_channel: order.sales_channel,
  warehouse_status: order.warehouse_status,
  tracking_code: order.tracking_code,
  shipping_status: order.shipping_status,
  invoice_code: order.invoice_code,
  invoice_snapshot: mapInvoiceSnapshot(order.invoice_snapshot_json),
  created_by: order.created_by,
  confirmed_by: order.confirmed_by,
  created_at: order.created_at.toISOString(),
  updated_at: order.updated_at.toISOString(),
});
