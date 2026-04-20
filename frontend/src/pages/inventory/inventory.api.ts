import { apiClient } from '@/api/api-client'

const ENDPOINT = '/inventory'

export type InventoryStockListItem = {
  product_variant_id: string
  product_id: number
  product_name: string
  product_status: 'active' | 'inactive' | 'draft' | 'deleted'
  display_name: string
  sku: string
  unit: string | null
  image_url: string | null
  on_hand: number
  available: number
  committed: number
  packing: number
  incoming: number
  selling_price: string
  cogs: string
  is_variant: boolean
}

export type InventoryAuditLinePayload = {
  product_variant_id: string
  counted_on_hand?: number | null
  note?: string | null
}

export type InventoryAuditPayload = {
  audit_code?: string | null
  status?: 'draft'
  note?: string | null
  counted_at?: string | null
  account?: {
    id?: string | null
    name?: string | null
  } | null
  lines: InventoryAuditLinePayload[]
}

export type InventoryAuditLineItem = InventoryStockListItem & {
  id: number
  system_on_hand: number
  counted_on_hand: number | null
  delta_qty: number | null
  note: string | null
  created_at: string
  updated_at: string
  cogs: string | null
}

export type InventoryAuditItem = {
  id: number
  audit_code: string
  status: 'draft' | 'completed'
  note: string | null
  account: {
    id: string | null
    name: string | null
  }
  counted_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  summary: {
    total_lines: number
    counted_lines: number
    adjusted_lines: number
    total_delta_qty: number
  }
  lines: InventoryAuditLineItem[]
}

export type InventoryHistoryItem = {
  id: string
  created_at: string
  transaction_type: string
  action: string
  reason_code: string
  reason: string | null
  actor: {
    id: string | null
    name: string | null
  }
  reference_type: string | null
  reference_id: string | null
  reference_code: string | null
  note: string | null
  metadata: Record<string, unknown> | null
  changes: {
    on_hand: { delta: number; after: number }
    available: { delta: number; after: number }
    committed: { delta: number; after: number }
    packing: { delta: number; after: number }
    incoming: { delta: number; after: number }
  }
}

export type InventoryHistoryResponse = {
  items: InventoryHistoryItem[]
  next_cursor: string | null
}

export const inventoryApi = {
  getStockList: async (params?: Record<string, unknown>): Promise<InventoryStockListItem[]> => {
    return apiClient.get(`${ENDPOINT}/stock`, { params })
  },

  getAuditList: async (params?: Record<string, unknown>): Promise<InventoryAuditItem[]> => {
    return apiClient.get(`${ENDPOINT}/audits`, { params })
  },

  getAuditById: async (id: string | number): Promise<InventoryAuditItem> => {
    return apiClient.get(`${ENDPOINT}/audits/${id}`)
  },

  getHistory: async (
    productVariantId: string,
    params?: Record<string, unknown>,
  ): Promise<InventoryHistoryResponse> => {
    return apiClient.get(`${ENDPOINT}/${productVariantId}/history`, { params })
  },

  createAudit: async (data: InventoryAuditPayload): Promise<InventoryAuditItem> => {
    return apiClient.post(`${ENDPOINT}/audits`, data)
  },

  updateAudit: async (id: string | number, data: InventoryAuditPayload): Promise<InventoryAuditItem> => {
    return apiClient.put(`${ENDPOINT}/audits/${id}`, data)
  },

  deleteAudit: async (id: string | number): Promise<void> => {
    return apiClient.delete(`${ENDPOINT}/audits/${id}`)
  },

  completeAudit: async (id: string | number): Promise<InventoryAuditItem> => {
    return apiClient.post(`${ENDPOINT}/audits/${id}/complete`, {})
  },
}
