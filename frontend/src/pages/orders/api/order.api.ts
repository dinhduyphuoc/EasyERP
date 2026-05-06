import { apiClient } from '@/api/api-client'

const ENDPOINT = '/orders'

export type OrderPaymentStatus = 'unpaid' | 'paid' | 'deposit'
export type OrderProcessingStatus =
  | 'draft'
  | 'placed'
  | 'delivering'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'returned'
export type OrderType = 'sale' | 'return'
export type OrderInvoiceSnapshot = {
  invoice_type: 'b2b' | 'b2c'
  buyer_name: string
  company_name: string
  tax_code: string
  personal_id: string
  budget_unit_code: string
  email: string
  phone: string
  address_line: string
  note: string
}

export type OrderItem = {
  id: number
  spu_id?: number | null
  product_id: number | null
  sku_code?: string
  variant_sku: string | null
  product_name: string
  display_name?: string | null
  variant_label?: string | null
  sku: string
  image_url: string | null
  quantity: number
  unit_price: string
  discount_amount: string
  sub_total: string
  notes: string | null
}

export type OrderHistoryItem = {
  id: number
  event_type: string
  description: string
  actor_name: string | null
  metadata: Record<string, unknown> | null
  timestamp: string
}

export type OrderShippingProviderLogItem = {
  status: string
  status_name?: string | null
  label: string
  updated_at: string | null
}

export type OrderShippingTrackingLogItem = {
  status: string | null
  status_name?: string | null
  label: string
  updated_at: string | null
  raw: Record<string, unknown>
}

export type OrderShippingOrderInfo = {
  provider: 'ghn'
  order_id: number
  order_code: string
  tracking_code: string
  current_status: string | null
  status_name?: string | null
  leadtime: string | null
  finish_date: string | null
  logs: OrderShippingProviderLogItem[]
}

export type OrderShippingTrackingLogs = {
  provider: 'ghn'
  order_id: number
  order_code: string
  tracking_code: string
  logs: OrderShippingTrackingLogItem[]
}

export type OrderListItem = {
  id: number
  order_code: string
  order_type: OrderType
  order_date: string
  customer_id: number | null
  customer_info: {
    customer_code: string | null
    name: string
    phone: string
    email: string | null
    address: string | null
  }
  sub_total: string
  discount_amount: string
  shipping_fee: string
  total_amount: string
  deposit_amount: string
  paid_amount: string
  outstanding_amount: string
  payment_status: OrderPaymentStatus
  processing_status: OrderProcessingStatus
  shipping_service: string | null
  sales_channel: string | null
  order_notes: string | null
  payment_notes: string | null
  warehouse_status: string | null
  tracking_code: string | null
  shipping_status: string | null
  invoice_code: string | null
  invoice_snapshot: OrderInvoiceSnapshot
  created_by: string | null
  confirmed_by: string | null
  created_at: string
  updated_at: string
}

export type OrderDetailBase = OrderListItem & {
  payment_type_id: number | null
  from_address_id?: number | null
  to_address_id?: number | null
  return_address_id?: number | null
  from_address_detail?: {
    id: number
    state_id: number
    city_id: number
    district_id: number | null
    address_line: string
    address_line2: string | null
    state_name: string
    city_name: string
    district_name: string | null
    postal_code: string | null
    country_code: string
    latitude: string | null
    longitude: string | null
    note: string | null
  } | null
  to_address_detail?: {
    id: number
    state_id: number
    city_id: number
    district_id: number | null
    address_line: string
    address_line2: string | null
    state_name: string
    city_name: string
    district_name: string | null
    postal_code: string | null
    country_code: string
    latitude: string | null
    longitude: string | null
    note: string | null
  } | null
  return_address_detail?: {
    id: number
    state_id: number
    city_id: number
    district_id: number | null
    address_line: string
    address_line2: string | null
    state_name: string
    city_name: string
    district_name: string | null
    postal_code: string | null
    country_code: string
    latitude: string | null
    longitude: string | null
    note: string | null
  } | null
  from_name?: string | null
  from_phone?: string | null
  from_address?: string | null
  required_note?: string | null
  cod_amount?: string
  content?: string | null
  weight?: number | null
  length?: number | null
  width?: number | null
  height?: number | null
  insurance_value?: string
  service_id?: number | null
  service_type_id?: number | null
  pick_station_id?: number | null
  deliver_station_id?: number | null
  coupon?: string | null
  pick_shift?: number[]
  vat_enabled: boolean
  tax_amount: string
  vat_rate_percent: string
  vat_changed_by_user: boolean
  pricing_version: number
  status_timeline: Record<string, unknown>
  order_items: OrderItem[]
}

export type OrderDetailItem = OrderDetailBase & {
  order_history?: OrderHistoryItem[]
}

export type OrderEditItem = OrderDetailBase

export type PaginatedOrderList = {
  items: OrderListItem[]
  total: number
  page: number
  page_size: number
}

export type OrderOverviewPeriod = 'today' | 'this_month' | 'this_quarter' | 'last_6_months' | 'this_year'

export type OrderOverviewResponse = {
  source_options: string[]
  summary: {
    net_revenue: string
    total_cost: string
    gross_profit: string
    gross_margin_percent: string
    total_orders: number
    unpaid_orders: number
    average_order_value: string
    sold_quantity: number
    pending_shipping_orders: number
    delivering_orders: number
    cancelled_orders: number
  }
  previous_summary: {
    net_revenue: string
    total_cost: string
    gross_profit: string
    gross_margin_percent: string
    total_orders: number
    unpaid_orders: number
    average_order_value: string
    sold_quantity: number
    pending_shipping_orders: number
    delivering_orders: number
    cancelled_orders: number
  } | null
}

export type OrderOptionLookup = {
  payment_statuses: Array<{
    value: OrderPaymentStatus
    label: string
    description: string
  }>
  processing_statuses: Array<{
    value: OrderProcessingStatus
    label: string
    description: string
  }>
  order_types: Array<{
    value: OrderType
    label: string
  }>
  customers: Array<{
    id: number
    client_code: string
    full_name: string
    phone: string
    default_address: {
      id: number
      address: {
        id: number
        state_id: number
        city_id: number
        district_id: number | null
        address_line: string
        address_line2: string | null
        state_name: string
        city_name: string
        district_name: string | null
      }
    } | null
  }>
  products: Array<{
    spu_id?: number
    sku_code?: string
    sku: string
    label: string
    variant_kind: 'default' | 'generated'
    product_id: number
    product_name: string
    selling_price: string
    image_url: string | null
    stock_on_hand: number
    stock_available: number
  }>
  shipping_services: string[]
  sales_channels: string[]
}

export type OrderCustomerOption = OrderOptionLookup['customers'][number]
export type OrderProductOption = OrderOptionLookup['products'][number]

export type OrderCreatePayload = {
  order_code?: string
  order_date?: string
  order_type?: OrderType
  customer_id?: number | null
  customer_info?: {
    name?: string
    phone?: string
    email?: string | null
    address?: string | null
    customer_code?: string | null
  }
  from_address_id?: number | null
  to_address_id?: number | null
  return_address_id?: number | null
  from_address_detail?: {
    state_id?: number | null
    city_id?: number | null
    district_id?: number | null
    address_line?: string | null
    address_line2?: string | null
    postal_code?: string | null
    country_code?: string | null
    latitude?: number | string | null
    longitude?: number | string | null
    note?: string | null
  } | null
  to_address_detail?: {
    state_id?: number | null
    city_id?: number | null
    district_id?: number | null
    address_line?: string | null
    address_line2?: string | null
    postal_code?: string | null
    country_code?: string | null
    latitude?: number | string | null
    longitude?: number | string | null
    note?: string | null
  } | null
  from_name?: string | null
  from_phone?: string | null
  from_address?: string | null
  from_ward_name?: string | null
  from_district_name?: string | null
  from_province_name?: string | null
  cod_amount?: number | string | null
  content?: string | null
  weight?: number | null
  length?: number | null
  width?: number | null
  height?: number | null
  insurance_value?: number | string | null
  service_id?: number | null
  service_type_id?: number | null
  coupon?: string | null
  discount_amount?: number | string | null
  vat_enabled?: boolean | null
  tax_amount?: number | string | null
  vat_rate_percent?: number | string | null
  vat_changed_by_user?: boolean | null
  pricing_version?: number | null
  shipping_fee?: number | string | null
  payment_type_id?: number | null
  deposit_amount?: number | string | null
  paid_amount?: number | string | null
  payment_status?: OrderPaymentStatus
  processing_status?: OrderProcessingStatus
  shipping_service?: string | null
  sales_channel?: string | null
  order_notes?: string | null
  payment_notes?: string | null
  warehouse_status?: string | null
  tracking_code?: string | null
  shipping_status?: string | null
  invoice_code?: string | null
  invoice_snapshot?: Partial<OrderInvoiceSnapshot> | null
  created_by?: string | null
  confirmed_by?: string | null
  status_timeline?: Record<string, unknown>
  order_items?: Array<{
    spu_id?: number | null
    product_id?: number | null
    sku_code?: string
    variant_sku?: string | null
    product_name?: string
    sku?: string
    quantity: number
    unit_price: number | string
    discount_amount?: number | string | null
    notes?: string
  }>
}

export type OrderUpdatePayload = Partial<OrderCreatePayload>

export type OrderActionName =
  | 'confirm'
  | 'push_to_delivery'
  | 'mark_delivered'
  | 'add_payment'
  | 'confirm_full_payment'
  | 'mark_paid'
  | 'request_invoice'
  | 'complete'
  | 'cancel'
  | 'return_order'

export type OrderActionPayload = {
  actor_name?: string
  note?: string
  payment_amount?: number | string | null
  payment_method?: string | null
  vat_enabled?: boolean | null
  vat_rate_percent?: number | string | null
  vat_changed_by_user?: boolean | null
  shipping_service?: string | null
  tracking_code?: string | null
  shipping_status?: string | null
  from_name?: string | null
  from_phone?: string | null
  warehouse_status?: string | null
  invoice_code?: string | null
  invoice_snapshot?: Partial<OrderInvoiceSnapshot> | null
}

export type DuplicateOrderPayload = {
  actor_name?: string
  order_date?: string
}

export const orderApi = {
  getOrderOverview: async (
    params?: Record<string, unknown>,
  ): Promise<OrderOverviewResponse> => {
    return apiClient.get(`${ENDPOINT}/overview`, { params })
  },

  getOrders: async (params?: Record<string, unknown>): Promise<PaginatedOrderList> => {
    return apiClient.get(ENDPOINT, { params })
  },

  getOrderById: async (id: string | number): Promise<OrderDetailItem> => {
    return apiClient.get(`${ENDPOINT}/${id}`)
  },

  getOrderForEdit: async (id: string | number): Promise<OrderEditItem> => {
    return apiClient.get(`${ENDPOINT}/${id}/edit`)
  },

  getOrderHistory: async (id: string | number): Promise<OrderHistoryItem[]> => {
    return apiClient.get(`${ENDPOINT}/${id}/history`)
  },

  getInvoicePrintReadyHtml: async (id: string | number): Promise<string> => {
    return apiClient.get(`${ENDPOINT}/${id}/invoice/print-ready`, {
      responseType: 'text',
      headers: {
        Accept: 'text/html',
      },
    })
  },

  getInvoicePdf: async (id: string | number, options?: { download?: boolean }): Promise<ArrayBuffer> => {
    return apiClient.get(`${ENDPOINT}/${id}/invoice/pdf`, {
      params: options?.download ? { download: '1' } : undefined,
      responseType: 'arraybuffer',
      headers: {
        Accept: 'application/pdf',
      },
    })
  },

  getGHNOrderInfo: async (id: string | number): Promise<OrderShippingOrderInfo> => {
    return apiClient.get(`${ENDPOINT}/${id}/shipping/ghn/order-info`)
  },

  getGHNTrackingLogs: async (id: string | number): Promise<OrderShippingTrackingLogs> => {
    return apiClient.get(`${ENDPOINT}/${id}/shipping/ghn/tracking-logs`)
  },

  getOrderOptions: async (): Promise<OrderOptionLookup> => {
    return apiClient.get(`${ENDPOINT}/options`)
  },

  searchCustomers: async (
    params?: Record<string, unknown>,
  ): Promise<{ items: OrderCustomerOption[] }> => {
    return apiClient.get(`${ENDPOINT}/options/customers`, { params })
  },

  searchProducts: async (
    params?: Record<string, unknown>,
  ): Promise<{ items: OrderProductOption[] }> => {
    return apiClient.get(`${ENDPOINT}/options/products`, { params })
  },

  createOrder: async (payload: OrderCreatePayload): Promise<OrderDetailItem> => {
    return apiClient.post(ENDPOINT, payload)
  },

  updateOrder: async (id: string | number, payload: OrderUpdatePayload): Promise<OrderDetailItem> => {
    return apiClient.patch(`${ENDPOINT}/${id}`, payload)
  },

  duplicateOrder: async (
    id: string | number,
    payload: DuplicateOrderPayload = {},
  ): Promise<OrderDetailItem> => {
    return apiClient.post(`${ENDPOINT}/${id}/duplicate`, payload)
  },

  runAction: async (
    id: string | number,
    action: OrderActionName,
    payload: OrderActionPayload = {},
  ): Promise<OrderDetailItem> => {
    return apiClient.post(`${ENDPOINT}/${id}/actions/${action}`, payload, {
      timeout: action === 'push_to_delivery' ? 20000 : undefined,
    })
  },
}
