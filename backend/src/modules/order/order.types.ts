export type OrderPaymentStatusInput = "unpaid" | "paid" | "deposit";
export type OrderProcessingStatusInput =
  | "draft"
  | "placed"
  | "confirmed"
  | "picked_up"
  | "delivering"
  | "completed"
  | "cancelled"
  | "returned";
export type OrderTypeInput = "sale" | "return";

export interface OrderListQuery {
  search?: string;
  payment_status?: OrderPaymentStatusInput;
  processing_status?: OrderProcessingStatusInput;
  order_type?: OrderTypeInput;
  customer_id?: string;
  view?: "all" | "drafts" | "returns" | "cancelled" | "incomplete";
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
  to_ward_code?: string | null;
  to_district_id?: number | null;
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
  tax_amount?: number | string | null;
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
  shipping_service?: string | null;
  tracking_code?: string | null;
  shipping_status?: string | null;
  warehouse_status?: string | null;
  invoice_code?: string | null;
}

export type OrderActionName =
  | "confirm"
  | "confirm_shipping"
  | "push_to_delivery"
  | "mark_paid"
  | "request_invoice"
  | "complete"
  | "cancel"
  | "return_order";
