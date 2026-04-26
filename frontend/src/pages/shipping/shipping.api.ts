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

export type ShippingProviderProvince = {
  id: number
  code: string
  name: string
}

export type ShippingProviderDistrict = {
  id: number
  province_id: number
  code: string
  name: string
}

export type ShippingProviderWard = {
  code: string
  district_id: number
  name: string
}

export type ShippingAvailableServiceItem = {
  service_id: number
  service_type_id: number
  short_name: string
}

export type ShippingCanonicalLocationInput = {
  address_id?: number | string | null
  state_id?: number | string | null
  city_id?: number | string | null
  district_id?: number | string | null
}

export type ShippingResolvedLocation = {
  address_id: number | null
  state: {
    id: number
    code: string
    name: string
    normalized_name: string
  }
  city: {
    id: number
    code: string
    name: string
    normalized_name: string
  }
  district: {
    id: number
    code: string
    name: string
    normalized_name: string
  } | null
  provider_province: {
    id: number
    external_id: string
    code: string | null
    name: string
  }
  provider_district: {
    id: number
    external_id: string
    code: string | null
    name: string
  }
  provider_ward: {
    id: number
    external_id: string
    code: string | null
    name: string
  } | null
  mapping_source: {
    state: string
    city: string
    district: string | null
  }
}

export type ShippingFeeQuote = {
  total: number
  service_fee: number
  insurance_fee: number
  pick_station_fee: number
  coupon_value: number
  r2s_fee: number
  document_return: number
  double_check: number
  cod_fee: number
  pick_remote_areas_fee: number
  deliver_remote_areas_fee: number
  cod_failed_fee: number
} | null

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

  listProviderProvinces: async (
    providerCode: string,
    storeId = DEFAULT_STORE_ID,
  ): Promise<{ store_id: string; provider_code: string; items: ShippingProviderProvince[] }> => {
    return apiClient.get(`${ENDPOINT}/providers/${providerCode}/addresses/provinces`, {
      params: { store_id: storeId },
    })
  },

  listProviderDistricts: async (
    providerCode: string,
    params: { province_id: number; store_id?: string },
  ): Promise<{ store_id: string; provider_code: string; province_id: number; items: ShippingProviderDistrict[] }> => {
    return apiClient.get(`${ENDPOINT}/providers/${providerCode}/addresses/districts`, {
      params,
    })
  },

  listProviderWards: async (
    providerCode: string,
    params: { district_id: number; store_id?: string },
  ): Promise<{ store_id: string; provider_code: string; district_id: number; items: ShippingProviderWard[] }> => {
    return apiClient.get(`${ENDPOINT}/providers/${providerCode}/addresses/wards`, {
      params,
    })
  },

  listAvailableServices: async (
    providerCode: string,
    payload: { from_district_id: number; to_district_id: number; store_id?: string },
  ): Promise<{ store_id: string; provider_code: string; items: ShippingAvailableServiceItem[] }> => {
    return apiClient.post(`${ENDPOINT}/providers/${providerCode}/services`, payload)
  },

  resolveLocation: async (
    providerCode: string,
    payload: {
      store_id?: string
      location: ShippingCanonicalLocationInput
    },
  ): Promise<{ store_id: string; provider_code: string; location: ShippingResolvedLocation }> => {
    return apiClient.post(`${ENDPOINT}/providers/${providerCode}/locations/resolve`, payload)
  },

  listAvailableServicesByLocation: async (
    providerCode: string,
    payload: {
      store_id?: string
      from_location: ShippingCanonicalLocationInput
      to_location: ShippingCanonicalLocationInput
    },
  ): Promise<{
    store_id: string
    provider_code: string
    resolved_from: ShippingResolvedLocation
    resolved_to: ShippingResolvedLocation
    items: ShippingAvailableServiceItem[]
  }> => {
    return apiClient.post(`${ENDPOINT}/providers/${providerCode}/services/by-location`, payload)
  },

  calculateFee: async (
    providerCode: string,
    payload: {
      store_id?: string
      from_district_id?: number | null
      from_ward_code?: string | null
      to_district_id: number
      to_ward_code: string
      service_id?: number | null
      service_type_id?: number | null
      weight?: number | null
      length?: number | null
      width?: number | null
      height?: number | null
      insurance_value?: number | null
      cod_value?: number | null
      coupon?: string | null
      items?: Array<{
        name: string
        quantity: number
        height?: number | null
        weight?: number | null
        length?: number | null
        width?: number | null
      }>
    },
  ): Promise<{ store_id: string; provider_code: string; quote: ShippingFeeQuote }> => {
    return apiClient.post(`${ENDPOINT}/providers/${providerCode}/fee`, payload)
  },

  calculateFeeByLocation: async (
    providerCode: string,
    payload: {
      store_id?: string
      from_location: ShippingCanonicalLocationInput
      to_location: ShippingCanonicalLocationInput
      service_id?: number | null
      service_type_id?: number | null
      weight?: number | null
      length?: number | null
      width?: number | null
      height?: number | null
      insurance_value?: number | null
      cod_value?: number | null
      coupon?: string | null
      items?: Array<{
        name: string
        quantity: number
        height?: number | null
        weight?: number | null
        length?: number | null
        width?: number | null
      }>
    },
  ): Promise<{
    store_id: string
    provider_code: string
    resolved_from: ShippingResolvedLocation
    resolved_to: ShippingResolvedLocation
    applied_service: ShippingAvailableServiceItem | null
    quote: ShippingFeeQuote
  }> => {
    return apiClient.post(`${ENDPOINT}/providers/${providerCode}/fee/by-location`, payload)
  },
}
