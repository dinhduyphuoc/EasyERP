import { apiClient } from '@/api/api-client'

export type StoreRecord = {
  id: string
  name: string
  slug: string
  owner_user_id: string
  default_currency: string
  default_timezone: string
  role: string
  profile: {
    business_type: string
    legal_full_name: string
    contact_email: string
    contact_phone: string
    state_id: number | null
    city_id: number | null
    district_id: number | null
    address_line: string
  }
  addresses: {
    default: Record<string, unknown>
    billing: Record<string, unknown>
    return: Record<string, unknown>
  }
  created_at: string
  updated_at: string
}

export const storeApi = {
  getStores() {
    return apiClient.get<never, StoreRecord[]>('/stores')
  },

  createStore(payload: { name: string; currency: string; timezone: string }) {
    return apiClient.post<never, StoreRecord>('/stores', payload)
  },

  getStore(id: string) {
    return apiClient.get<never, StoreRecord>(`/stores/${id}`)
  },

  updateStore(
    id: string,
    payload: {
      name?: string
      slug?: string
      default_currency?: string
      default_timezone?: string
      profile?: {
        business_type?: string
        legal_full_name?: string
        contact_email?: string
        contact_phone?: string
        state_id?: number | null
        city_id?: number | null
        district_id?: number | null
        address_line?: string
      }
      default_address?: Record<string, unknown>
      billing_address?: Record<string, unknown>
      return_address?: Record<string, unknown>
    },
  ) {
    return apiClient.patch<never, StoreRecord>(`/stores/${id}`, payload)
  },

  switchStore(storeId: string) {
    return apiClient.post<never, StoreRecord>('/stores/switch', { store_id: storeId })
  },

  deleteStore(id: string) {
    return apiClient.delete<never, { deleted: boolean }>(`/stores/${id}`)
  },
}
