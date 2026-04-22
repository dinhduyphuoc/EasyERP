import { apiClient } from '@/api/api-client'

const ENDPOINT = '/shipping'
const DEFAULT_STORE_ID = 'default-store'

export type ShippingConnectionStatusCode = 'disconnected' | 'connected' | 'error'

export type ShippingCredentialField = {
  key: string
  label: string
  placeholder?: string
  input_type: 'text' | 'password' | 'number'
  required: boolean
  min_length?: number
  helper_text?: string
}

export type ShippingProviderCardItem = {
  id: number
  code: string
  display_name: string
  short_description: string | null
  logo_url: string | null
  status: {
    code: ShippingConnectionStatusCode
    label: string
  }
  error_message: string | null
  connected_at: string | null
  disconnected_at: string | null
  last_verified_at: string | null
  updated_at: string | null
  credential_fields: ShippingCredentialField[]
  capabilities: {
    verify_connection: boolean
    warehouse_mapping: boolean
    create_shipment: boolean
    tracking: boolean
    webhook: boolean
  }
}

export type ShippingProviderListResponse = {
  store_id: string
  items: ShippingProviderCardItem[]
}

export type ShippingConnectionDetail = {
  provider: {
    id: number
    code: string
    display_name: string
    short_description: string | null
    logo_url: string | null
    credential_fields: ShippingCredentialField[]
    capabilities: {
      verify_connection: boolean
      warehouse_mapping: boolean
      create_shipment: boolean
      tracking: boolean
      webhook: boolean
    }
  }
  connection: {
    id: number | null
    store_id: string
    status: {
      code: ShippingConnectionStatusCode
      label: string
    }
    has_credentials: boolean
    masked_credentials: Record<string, string>
    metadata: Record<string, unknown>
    error_message: string | null
    last_sync_at: string | null
    last_verified_at: string | null
    connected_at: string | null
    disconnected_at: string | null
    created_at: string | null
    updated_at: string | null
    history_items: Array<{
      id: number
      action: string
      status: {
        code: ShippingConnectionStatusCode
        label: string
      }
      payload: Record<string, unknown>
      error_message: string | null
      actor_id: string | null
      actor_name: string | null
      created_at: string
    }>
  }
}

export type ShippingVerifyResponse = {
  store_id: string
  provider_code: string
  success: boolean
  message: string
  metadata: Record<string, unknown>
  status: {
    code: ShippingConnectionStatusCode
    label: string
  }
}

export const shippingApi = {
  listProviders: async (storeId = DEFAULT_STORE_ID): Promise<ShippingProviderListResponse> => {
    return apiClient.get(`${ENDPOINT}/providers`, {
      params: { store_id: storeId },
    })
  },

  getConnectionDetail: async (
    providerCode: string,
    storeId = DEFAULT_STORE_ID,
  ): Promise<ShippingConnectionDetail> => {
    return apiClient.get(`${ENDPOINT}/providers/${providerCode}`, {
      params: { store_id: storeId },
    })
  },

  connectProvider: async (
    providerCode: string,
    payload: {
      store_id?: string
      credentials: Record<string, string>
      metadata?: Record<string, unknown>
      verify?: boolean
    },
  ): Promise<ShippingConnectionDetail> => {
    return apiClient.post(`${ENDPOINT}/providers/${providerCode}/connect`, payload)
  },

  disconnectProvider: async (
    providerCode: string,
    payload: { store_id?: string },
  ): Promise<ShippingConnectionDetail> => {
    return apiClient.post(`${ENDPOINT}/providers/${providerCode}/disconnect`, payload)
  },

  verifyProvider: async (
    providerCode: string,
    payload: {
      store_id?: string
      credentials?: Record<string, string>
      metadata?: Record<string, unknown>
    },
  ): Promise<ShippingVerifyResponse> => {
    return apiClient.post(`${ENDPOINT}/providers/${providerCode}/verify`, payload)
  },
}
