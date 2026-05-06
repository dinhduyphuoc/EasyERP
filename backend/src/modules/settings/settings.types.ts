export type GeneralSettingsResponse = {
  tenant_id: string | null;
  defaults: {
    shipping_address: {
      contact_name: string;
      phone: string;
      state_id: number | null;
      city_id: number | null;
      district_id: number | null;
      address_line: string;
    };
    bank_account: {
      bank_name: string;
      bank_bin: string;
      bank_code: string;
      account_number: string;
      account_holder: string;
      qr_template: string;
    };
    vat: {
      enabled: boolean;
      rate_percent: number;
    };
    invoice: InvoiceSettings;
  };
};

export type InvoiceTemplateMode = "b2b" | "b2c" | "hybrid";

export type InvoiceSettings = {
  issuing_mode: InvoiceTemplateMode;
  seller: {
    legal_name: string;
    brand_name: string;
    tax_code: string;
    address_line: string;
    email: string;
    phone: string;
  };
  numbering: {
    invoice_series_prefix: string;
    starting_sequence: number;
  };
  display: {
    primary_color: string;
    accent_color: string;
    show_company_stamp_note: boolean;
    show_bank_account: boolean;
    show_payment_qr: boolean;
    footer_note_b2b: string;
    footer_note_b2c: string;
  };
  templates: {
    b2b_html: string;
    b2c_html: string;
  };
  compliance: {
    decree_reference: string;
    effective_from: string;
    separate_digital_signature_time: boolean;
    buyer_info_on_request_for_b2c: boolean;
    include_tax_authority_qr: boolean;
  };
};

export type UpdateGeneralSettingsInput = {
  defaults?: {
    shipping_address?: {
      contact_name?: string | null;
      phone?: string | null;
      state_id?: number | string | null;
      city_id?: number | string | null;
      district_id?: number | string | null;
      address_line?: string | null;
    };
    bank_account?: {
      bank_name?: string | null;
      bank_bin?: string | null;
      bank_code?: string | null;
      account_number?: string | null;
      account_holder?: string | null;
      qr_template?: string | null;
    };
    vat?: {
      enabled?: boolean | null;
      rate_percent?: number | string | null;
    };
    invoice?: {
      issuing_mode?: InvoiceTemplateMode | null;
      seller?: {
        legal_name?: string | null;
        brand_name?: string | null;
        tax_code?: string | null;
        address_line?: string | null;
        email?: string | null;
        phone?: string | null;
      };
      numbering?: {
        invoice_series_prefix?: string | null;
        starting_sequence?: number | string | null;
      };
      display?: {
        primary_color?: string | null;
        accent_color?: string | null;
        show_company_stamp_note?: boolean | null;
        show_bank_account?: boolean | null;
        show_payment_qr?: boolean | null;
        footer_note_b2b?: string | null;
        footer_note_b2c?: string | null;
      };
      templates?: {
        b2b_html?: string | null;
        b2c_html?: string | null;
      };
      compliance?: {
        decree_reference?: string | null;
        effective_from?: string | null;
        separate_digital_signature_time?: boolean | null;
        buyer_info_on_request_for_b2c?: boolean | null;
        include_tax_authority_qr?: boolean | null;
      };
    };
  };
};

export type VietQrBankItem = {
  id: number;
  name: string;
  code: string;
  bin: string;
  isTransfer: number;
  short_name: string;
  logo: string;
  support: number;
};

export type VietQrTemplateItem = {
  name: string;
  template: string;
  demo: string;
};

export type VietQrGenerateInput = {
  bank_bin?: string | null;
  account_name?: string | null;
  account_number?: string | null;
  amount?: string | number | null;
  memo?: string | null;
  template?: string | null;
  media?: string | null;
};

export type VietQrGenerateResponse = {
  code: string;
  desc: string;
  data: {
    acqId: string;
    accountName: string;
    qrDataURL: string;
  };
  quick_link: string;
  transfer_content: string;
};
