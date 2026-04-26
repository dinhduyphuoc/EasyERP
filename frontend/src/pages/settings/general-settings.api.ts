import { apiClient } from '@/api/api-client'

const ENDPOINT = '/settings/general'

export type GeneralSettings = {
  tenant_id: string | null
  defaults: {
    shipping_address: {
      contact_name: string
      phone: string
      state_id: number | null
      city_id: number | null
      district_id: number | null
      address_line: string
    }
    bank_account: {
      bank_name: string
      bank_bin: string
      bank_code: string
      account_number: string
      account_holder: string
      qr_template: string
    }
  }
}

export type UpdateGeneralSettingsPayload = {
  defaults: {
    shipping_address: {
      contact_name: string
      phone: string
      state_id: number | null
      city_id: number | null
      district_id: number | null
      address_line: string
    }
    bank_account: {
      bank_name: string
      bank_bin: string
      bank_code: string
      account_number: string
      account_holder: string
      qr_template: string
    }
  }
}

export type VietQrBankItem = {
  id: number
  name: string
  code: string
  bin: string
  isTransfer: number
  short_name: string
  logo: string
  support: number
}

export const generalSettingsApi = {
  getGeneralSettings: async (): Promise<GeneralSettings> => {
    return apiClient.get(ENDPOINT)
  },

  updateGeneralSettings: async (
    payload: UpdateGeneralSettingsPayload,
  ): Promise<GeneralSettings> => {
    return apiClient.put(ENDPOINT, payload)
  },

  getVietQrBanks: async (): Promise<{
    code: string
    desc: string
    data: VietQrBankItem[]
  }> => {
    return apiClient.get(`${ENDPOINT}/payment-methods/vietqr/banks`)
  },
}
