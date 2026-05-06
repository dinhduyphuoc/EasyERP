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
    invoice: {
      issuing_mode: 'b2b' | 'b2c' | 'hybrid'
      seller: {
        legal_name: string
        brand_name: string
        tax_code: string
        address_line: string
        email: string
        phone: string
      }
      numbering: {
        invoice_series_prefix: string
        starting_sequence: number
      }
      display: {
        primary_color: string
        accent_color: string
        show_company_stamp_note: boolean
        show_bank_account: boolean
        show_payment_qr: boolean
        footer_note_b2b: string
        footer_note_b2c: string
      }
      templates: {
        b2b_html: string
        b2c_html: string
      }
      compliance: {
        decree_reference: string
        effective_from: string
        separate_digital_signature_time: boolean
        buyer_info_on_request_for_b2c: boolean
        include_tax_authority_qr: boolean
      }
    }
  }
}

export type UpdateGeneralSettingsPayload = {
  defaults: {
    shipping_address?: {
      contact_name: string
      phone: string
      state_id: number | null
      city_id: number | null
      district_id: number | null
      address_line: string
    }
    bank_account?: {
      bank_name: string
      bank_bin: string
      bank_code: string
      account_number: string
      account_holder: string
      qr_template: string
    }
    vat?: {
      enabled: boolean
      rate_percent: number
    }
    invoice?: {
      issuing_mode: 'b2b' | 'b2c' | 'hybrid'
      seller: {
        legal_name: string
        brand_name: string
        tax_code: string
        address_line: string
        email: string
        phone: string
      }
      numbering: {
        invoice_series_prefix: string
        starting_sequence: number
      }
      display: {
        primary_color: string
        accent_color: string
        show_company_stamp_note: boolean
        show_bank_account: boolean
        show_payment_qr: boolean
        footer_note_b2b: string
        footer_note_b2c: string
      }
      templates: {
        b2b_html: string
        b2c_html: string
      }
      compliance: {
        decree_reference: string
        effective_from: string
        separate_digital_signature_time: boolean
        buyer_info_on_request_for_b2c: boolean
        include_tax_authority_qr: boolean
      }
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
