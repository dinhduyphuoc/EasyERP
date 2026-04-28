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
