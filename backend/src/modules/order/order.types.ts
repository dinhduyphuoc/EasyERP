export type OrderPaymentStatusInput = "unpaid" | "paid" | "deposit";
export type OrderProcessingStatusInput =
  | "draft"
  | "placed"
  | "delivering"
  | "delivered"
  | "completed"
  | "cancelled"
  | "returned";
export type OrderTypeInput = "sale" | "return";
export type OrderInvoiceTypeInput = "b2b" | "b2c";

export interface OrderInvoiceSnapshotInput {
  invoice_type?: OrderInvoiceTypeInput | null;
  buyer_name?: string | null;
  company_name?: string | null;
  tax_code?: string | null;
  personal_id?: string | null;
  budget_unit_code?: string | null;
  email?: string | null;
  phone?: string | null;
  address_line?: string | null;
  note?: string | null;
}

export interface OrderListQuery {
  search?: string;
  payment_status?: OrderPaymentStatusInput;
  processing_status?: OrderProcessingStatusInput;
  order_type?: OrderTypeInput;
  customer_id?: string;
  page?: string;
  page_size?: string;
  view?: "all" | "drafts" | "returns" | "cancelled" | "incomplete";
}

export interface OrderOverviewQuery {
  source?: string;
  period?: "today" | "this_month" | "this_quarter" | "last_6_months" | "this_year";
}

export interface OrderOverviewResponse {
  source_options: string[];
  summary: {
    net_revenue: string;
    total_cost: string;
    gross_profit: string;
    gross_margin_percent: string;
    total_orders: number;
    unpaid_orders: number;
    average_order_value: string;
    sold_quantity: number;
    pending_shipping_orders: number;
    delivering_orders: number;
    cancelled_orders: number;
  };
  previous_summary: {
    net_revenue: string;
    total_cost: string;
    gross_profit: string;
    gross_margin_percent: string;
    total_orders: number;
    unpaid_orders: number;
    average_order_value: string;
    sold_quantity: number;
    pending_shipping_orders: number;
    delivering_orders: number;
    cancelled_orders: number;
  } | null;
}

export interface OrderOptionSearchQuery {
  search?: string;
  limit?: string;
  ids?: string;
  skus?: string;
}

export interface OrderParams {
  id?: string;
}

export interface OrderShippingPrintResponse {
  provider: "ghn";
  order_id: number;
  order_code: string;
  tracking_code: string;
  token: string;
  expires_in_minutes: number;
  print_urls: {
    a5: string;
    "80x80": string;
    "52x70": string;
  };
}

export interface OrderShippingProviderLogItem {
  status: string;
  label: string;
  updated_at: string | null;
}

export interface OrderShippingTrackingLogItem {
  status: string | null;
  label: string;
  updated_at: string | null;
  raw: Record<string, unknown>;
}

export interface OrderShippingOrderInfoResponse {
  provider: "ghn";
  order_id: number;
  order_code: string;
  tracking_code: string;
  current_status: string | null;
  leadtime: string | null;
  finish_date: string | null;
  logs: OrderShippingProviderLogItem[];
}

export interface OrderShippingTrackingLogsResponse {
  provider: "ghn";
  order_id: number;
  order_code: string;
  tracking_code: string;
  logs: OrderShippingTrackingLogItem[];
}

export interface OrderHistoryResponseItem {
  id: number;
  event_type: string;
  description: string;
  actor_name: string | null;
  metadata: unknown;
  timestamp: string;
}

export interface DuplicateOrderRequestInput {
  actor_name?: string;
  order_date?: string;
}

export interface OrderHistoryInput {
  event_type: string;
  description: string;
  actor_name?: string;
  metadata?: Record<string, unknown>;
}

export interface AddressRequestInput {
  id?: number | null;
  state_id?: number | null;
  city_id?: number | null;
  district_id?: number | null;
  address_line?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  note?: string | null;
}

export interface OrderItemRequestInput {
  product_id?: number | null;
  variant_sku?: string | null;
  product_name?: string;
  sku?: string;
  quantity: number;
  unit_price: number | string;
  discount_amount?: number | string | null;
  sub_total?: number | string | null;
  notes?: string;
  item_weight?: number | null;
  item_length?: number | null;
  item_width?: number | null;
  item_height?: number | null;
  category_level1?: string | null;
}

export interface OrderRequestInput {
  order_code?: string;
  order_date?: string;
  order_type?: OrderTypeInput;
  customer_id?: number | null;
  customer_info?: {
    name?: string;
    phone?: string;
    email?: string | null;
    address?: string | null;
    customer_code?: string | null;
  };
  client_order_code?: string | null;
  note?: string | null;
  required_note?: string | null;
  payment_type_id?: number | null;
  from_address_id?: number | null;
  to_address_id?: number | null;
  return_address_id?: number | null;
  from_address_detail?: AddressRequestInput | null;
  to_address_detail?: AddressRequestInput | null;
  return_address_detail?: AddressRequestInput | null;
  from_name?: string | null;
  from_phone?: string | null;
  from_address?: string | null;
  from_ward_name?: string | null;
  from_district_name?: string | null;
  from_province_name?: string | null;
  return_phone?: string | null;
  return_address?: string | null;
  return_district_id?: number | null;
  return_ward_code?: string | null;
  cod_amount?: number | string | null;
  content?: string | null;
  weight?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  insurance_value?: number | string | null;
  service_id?: number | null;
  service_type_id?: number | null;
  pick_station_id?: number | null;
  deliver_station_id?: number | null;
  coupon?: string | null;
  pick_shift?: number[] | null;
  sub_total?: number | string | null;
  discount_amount?: number | string | null;
  vat_enabled?: boolean | null;
  tax_amount?: number | string | null;
  vat_rate_percent?: number | string | null;
  vat_changed_by_user?: boolean | null;
  pricing_version?: number | null;
  shipping_fee?: number | string | null;
  total_amount?: number | string | null;
  deposit_amount?: number | string | null;
  paid_amount?: number | string | null;
  outstanding_amount?: number | string | null;
  payment_status?: OrderPaymentStatusInput;
  processing_status?: OrderProcessingStatusInput;
  shipping_service?: string | null;
  sales_channel?: string | null;
  order_notes?: string | null;
  payment_notes?: string | null;
  warehouse_status?: string | null;
  tracking_code?: string | null;
  shipping_status?: string | null;
  invoice_code?: string | null;
  invoice_snapshot?: OrderInvoiceSnapshotInput | null;
  created_by?: string | null;
  confirmed_by?: string | null;
  status_timeline?: Record<string, unknown>;
  order_items?: OrderItemRequestInput[];
  order_history?: OrderHistoryInput[];
}

export interface UpdateOrderRequestInput extends Partial<OrderRequestInput> {}

export interface OrderActionRequestInput {
  actor_name?: string;
  note?: string;
  payment_amount?: number | string | null;
  payment_method?: string | null;
  vat_enabled?: boolean | null;
  vat_rate_percent?: number | string | null;
  vat_changed_by_user?: boolean | null;
  shipping_service?: string | null;
  tracking_code?: string | null;
  shipping_status?: string | null;
  from_name?: string | null;
  from_phone?: string | null;
  warehouse_status?: string | null;
  invoice_code?: string | null;
  invoice_snapshot?: OrderInvoiceSnapshotInput | null;
}

export type OrderActionName =
  | "confirm"
  | "push_to_delivery"
  | "mark_delivered"
  | "add_payment"
  | "confirm_full_payment"
  | "mark_paid"
  | "request_invoice"
  | "complete"
  | "cancel"
  | "return_order";
