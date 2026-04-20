import { apiClient } from '@/api/api-client'

const ENDPOINT = '/orders'

export type OrderPaymentStatus = 'unpaid' | 'paid' | 'deposit'
export type OrderProcessingStatus =
  | 'draft'
  | 'placed'
  | 'confirmed'
  | 'picked_up'
  | 'delivering'
  | 'completed'
  | 'returned'
export type OrderType = 'sale' | 'return'

export type OrderItem = {
  id: number
  product_id: number | null
  variant_sku: string | null
  product_name: string
  sku: string
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
  tax_amount: string
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
  created_by: string | null
  confirmed_by: string | null
  status_timeline: Record<string, unknown>
  created_at: string
  updated_at: string
  order_items: OrderItem[]
  order_history: OrderHistoryItem[]
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
  }>
  products: Array<{
    sku: string
    label: string
    product_id: number
    product_name: string
    selling_price: string
  }>
  shipping_services: string[]
  sales_channels: string[]
}

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
  tax_amount?: number | string | null
  shipping_fee?: number | string | null
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
  created_by?: string | null
  confirmed_by?: string | null
  status_timeline?: Record<string, unknown>
  order_items?: Array<{
    product_id?: number | null
    variant_sku?: string | null
    product_name?: string
    sku?: string
    quantity: number
    unit_price: number | string
    discount_amount?: number | string | null
    notes?: string
  }>
}

export const orderApi = {
  getOrders: async (params?: Record<string, unknown>): Promise<OrderListItem[]> => {
    return apiClient.get(ENDPOINT, { params })
  },

  getOrderById: async (id: string | number): Promise<OrderListItem> => {
    return apiClient.get(`${ENDPOINT}/${id}`)
  },

  getOrderOptions: async (): Promise<OrderOptionLookup> => {
    return apiClient.get(`${ENDPOINT}/options`)
  },

  createOrder: async (payload: OrderCreatePayload): Promise<OrderListItem> => {
    return apiClient.post(ENDPOINT, payload)
  },
}
