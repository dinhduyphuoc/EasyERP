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
    vat: {
      enabled: boolean
      rate_percent: number
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
    vat: {
      enabled: boolean
      rate_percent: number
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

export type VietQrGeneratePayload = {
  bank_bin?: string | null
  account_name?: string | null
  account_number?: string | null
  amount?: string | number | null
  memo?: string | null
  template?: string | null
  media?: string | null
}

export type VietQrGenerateResponse = {
  code: string
  desc: string
  data: {
    acqId: string
    accountName: string
    qrDataURL: string
  }
  quick_link: string
  transfer_content: string
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

  generateVietQr: async (
    payload: VietQrGeneratePayload,
  ): Promise<VietQrGenerateResponse> => {
    return apiClient.post(`${ENDPOINT}/payment-methods/vietqr/qr`, payload)
  },
}
