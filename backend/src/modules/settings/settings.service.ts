import { BadRequestError } from "@/common";
import { VietQrService } from "@/lib/vietqr";
import { SettingsRepository } from "./settings.repository";
import type {
  GeneralSettingsResponse,
  InvoiceSettings,
  UpdateGeneralSettingsInput,
  VietQrGenerateInput,
  VietQrGenerateResponse,
} from "./settings.types";

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const toTrimmedString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const toOptionalInt = (value: unknown, fieldName: string): number | null => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BadRequestError(`${fieldName} must be a positive integer`);
  }

  return parsed;
};

const toBoolean = (value: unknown): boolean => value === true;

const parseInvoiceTemplateMode = (value: unknown): InvoiceSettings["issuing_mode"] => {
  if (value === "b2b" || value === "b2c" || value === "hybrid") {
    return value;
  }

  return "hybrid";
};

const toNonNegativeNumber = (value: unknown, fieldName: string): number => {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new BadRequestError(`${fieldName} must be a non-negative number`);
  }

  return parsed;
};

const toPositiveInteger = (value: unknown, fieldName: string, fallback: number): number => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BadRequestError(`${fieldName} must be a positive integer`);
  }

  return parsed;
};

const DEFAULT_B2B_TEMPLATE = `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <title>{{invoice_title}} {{invoice_code}}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
      .page { max-width: 960px; margin: 0 auto; }
      .hero { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 20px; }
      .panel { border: 1px solid #d0d5dd; border-radius: 16px; padding: 16px; background: #fff; }
      .meta { color: #475467; font-size: 13px; }
      .title { font-size: 28px; font-weight: 800; margin: 0 0 8px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border-bottom: 1px solid #eaecf0; padding: 10px 8px; font-size: 14px; text-align: left; vertical-align: top; }
      th { background: #f8fafc; }
      .totals { width: 320px; margin-left: auto; margin-top: 20px; }
      .totals-row { display: flex; justify-content: space-between; padding: 6px 0; }
      .footer { margin-top: 24px; color: #667085; font-size: 13px; line-height: 1.7; }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="hero">
        <div class="panel" style="flex: 1;">
          <div class="title">{{invoice_title}}</div>
          <div class="meta">Mẫu số / Ký hiệu: {{invoice_series}}</div>
          <div class="meta">Số hóa đơn: {{invoice_code}}</div>
          <div class="meta">Ngày lập: {{invoice_date}}</div>
          <div class="meta">Ngày ký số: {{invoice_signed_at}}</div>
        </div>
        <div class="panel" style="width: 320px;">
          <strong>{{seller_legal_name}}</strong>
          <div class="meta">MST: {{seller_tax_code}}</div>
          <div class="meta">{{seller_address}}</div>
          <div class="meta">{{seller_email}} • {{seller_phone}}</div>
        </div>
      </div>

      <div class="grid">
        <div class="panel">
          <strong>Người bán</strong>
          <div class="meta">{{seller_legal_name}}</div>
          <div class="meta">{{seller_address}}</div>
        </div>
        <div class="panel">
          <strong>Người mua</strong>
          <div class="meta">{{buyer_name}}</div>
          <div class="meta">{{buyer_company_name}}</div>
          <div class="meta">MST/Định danh: {{buyer_tax_or_personal_id}}</div>
          <div class="meta">{{buyer_address}}</div>
        </div>
      </div>

      <div class="panel">
        <table>
          <thead>
            <tr>
              <th>Hàng hóa / dịch vụ</th>
              <th>SKU</th>
              <th>SL</th>
              <th>Đơn giá</th>
              <th>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {{items_rows_html}}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-row"><span>Cộng tiền hàng</span><strong>{{sub_total}}</strong></div>
          <div class="totals-row"><span>Chiết khấu</span><strong>{{discount_amount}}</strong></div>
          <div class="totals-row"><span>VAT</span><strong>{{tax_amount}}</strong></div>
          <div class="totals-row"><span>Phí giao hàng</span><strong>{{shipping_fee}}</strong></div>
          <div class="totals-row"><span>Tổng thanh toán</span><strong>{{total_amount}}</strong></div>
        </div>
      </div>

      <div class="footer">
        <div>{{footer_note}}</div>
        <div>Mã tra cứu: {{lookup_code}}</div>
      </div>
    </div>
  </body>
</html>`;

const DEFAULT_B2C_TEMPLATE = `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <title>{{invoice_title}} {{invoice_code}}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 18px; color: #111827; }
      .receipt { max-width: 720px; margin: 0 auto; border: 1px solid #d0d5dd; border-radius: 16px; padding: 18px; }
      .title { font-size: 24px; font-weight: 800; margin: 0 0 10px; }
      .meta { color: #4b5563; font-size: 13px; line-height: 1.7; }
      table { width: 100%; border-collapse: collapse; margin-top: 14px; }
      th, td { border-bottom: 1px solid #e5e7eb; padding: 10px 6px; font-size: 14px; text-align: left; }
      th { background: #f9fafb; }
      .totals { margin-top: 14px; }
      .totals-row { display: flex; justify-content: space-between; padding: 4px 0; }
    </style>
  </head>
  <body>
    <div class="receipt">
      <div class="title">{{invoice_title}}</div>
      <div class="meta">{{seller_brand_name}} • MST: {{seller_tax_code}}</div>
      <div class="meta">{{seller_address}}</div>
      <div class="meta">Thời điểm lập: {{invoice_date}} • Mã tra cứu: {{lookup_code}}</div>
      <div class="meta">Người mua: {{buyer_name}}</div>

      <table>
        <thead>
          <tr>
            <th>Mặt hàng</th>
            <th>SL</th>
            <th>Đơn giá</th>
            <th>Thanh toán</th>
          </tr>
        </thead>
        <tbody>
          {{items_rows_html}}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-row"><span>Tạm tính</span><strong>{{sub_total}}</strong></div>
        <div class="totals-row"><span>Chiết khấu</span><strong>{{discount_amount}}</strong></div>
        <div class="totals-row"><span>VAT</span><strong>{{tax_amount}}</strong></div>
        <div class="totals-row"><span>Tổng thanh toán</span><strong>{{total_amount}}</strong></div>
      </div>

      <div class="meta" style="margin-top: 16px;">{{footer_note}}</div>
    </div>
  </body>
</html>`;

const isShippingAddressEmpty = (value: {
  contact_name: string;
  phone: string;
  state_id: number | null;
  city_id: number | null;
  district_id: number | null;
  address_line: string;
}) =>
  !value.contact_name &&
  !value.phone &&
  !value.state_id &&
  !value.city_id &&
  !value.district_id &&
  !value.address_line;

const buildShippingAddressFromStoreProfile = (profileJson: unknown) => {
  const profile = toRecord(profileJson);

  return {
    contact_name: "",
    phone: toTrimmedString(profile.contact_phone),
    state_id: toOptionalInt(profile.state_id, "store.profile.state_id"),
    city_id: toOptionalInt(profile.city_id, "store.profile.city_id"),
    district_id: toOptionalInt(profile.district_id, "store.profile.district_id"),
    address_line: toTrimmedString(profile.address_line),
  };
};

const buildInvoiceDefaultsFromStore = (args: {
  profileJson: unknown;
  billingAddressJson: unknown;
  bankAccount: GeneralSettingsResponse["defaults"]["bank_account"];
}): InvoiceSettings["seller"] => {
  const profile = toRecord(args.profileJson);
  const billingAddress = toRecord(args.billingAddressJson);

  return {
    legal_name: toTrimmedString(profile.legal_full_name),
    brand_name: toTrimmedString(profile.brand_name) || toTrimmedString(profile.store_name),
    tax_code: toTrimmedString(profile.tax_code),
    address_line:
      toTrimmedString(billingAddress.address_line) ||
      toTrimmedString(profile.address_line),
    email: toTrimmedString(profile.contact_email),
    phone: toTrimmedString(profile.contact_phone),
  };
};

const buildInvoicePayload = (invoiceJson: unknown): InvoiceSettings => {
  const invoice = toRecord(invoiceJson);
  const seller = toRecord(invoice.seller);
  const numbering = toRecord(invoice.numbering);
  const display = toRecord(invoice.display);
  const compliance = toRecord(invoice.compliance);
  const templates = toRecord(invoice.templates);

  return {
    issuing_mode: parseInvoiceTemplateMode(invoice.issuing_mode),
    seller: {
      legal_name: toTrimmedString(seller.legal_name),
      brand_name: toTrimmedString(seller.brand_name),
      tax_code: toTrimmedString(seller.tax_code),
      address_line: toTrimmedString(seller.address_line),
      email: toTrimmedString(seller.email),
      phone: toTrimmedString(seller.phone),
    },
    numbering: {
      invoice_series_prefix: toTrimmedString(numbering.invoice_series_prefix) || "AA",
      starting_sequence: toPositiveInteger(
        numbering.starting_sequence,
        "defaults.invoice.numbering.starting_sequence",
        1,
      ),
    },
    display: {
      primary_color: toTrimmedString(display.primary_color) || "#0f766e",
      accent_color: toTrimmedString(display.accent_color) || "#f59e0b",
      show_company_stamp_note: display.show_company_stamp_note !== false,
      show_bank_account: display.show_bank_account !== false,
      show_payment_qr: display.show_payment_qr === true,
      footer_note_b2b:
        toTrimmedString(display.footer_note_b2b) ||
        "Mẫu hiển thị cần phản ánh đúng dữ liệu hóa đơn điện tử đã phát hành.",
      footer_note_b2c:
        toTrimmedString(display.footer_note_b2c) ||
        "Thông tin người mua hiển thị theo yêu cầu của khách hàng tại thời điểm lập hóa đơn.",
    },
    templates: {
      b2b_html: toTrimmedString(templates.b2b_html) || DEFAULT_B2B_TEMPLATE,
      b2c_html: toTrimmedString(templates.b2c_html) || DEFAULT_B2C_TEMPLATE,
    },
    compliance: {
      decree_reference:
        toTrimmedString(compliance.decree_reference) ||
        "Nghị định 123/2020/NĐ-CP, Nghị định 70/2025/NĐ-CP",
      effective_from: toTrimmedString(compliance.effective_from) || "2025-06-01",
      separate_digital_signature_time: compliance.separate_digital_signature_time !== false,
      buyer_info_on_request_for_b2c: compliance.buyer_info_on_request_for_b2c !== false,
      include_tax_authority_qr: compliance.include_tax_authority_qr !== false,
    },
  };
};

const buildDefaultsPayload = (
  shippingAddressJson: unknown,
  bankAccountJson: unknown,
  vatJson: unknown,
  invoiceJson: unknown,
): GeneralSettingsResponse["defaults"] => {
  const shippingAddress = toRecord(shippingAddressJson);
  const bankAccount = toRecord(bankAccountJson);
  const vat = toRecord(vatJson);

  return {
    shipping_address: {
      contact_name: toTrimmedString(shippingAddress.contact_name),
      phone: toTrimmedString(shippingAddress.phone),
      state_id: toOptionalInt(shippingAddress.state_id, "defaults.shipping_address.state_id"),
      city_id: toOptionalInt(shippingAddress.city_id, "defaults.shipping_address.city_id"),
      district_id: toOptionalInt(shippingAddress.district_id, "defaults.shipping_address.district_id"),
      address_line: toTrimmedString(shippingAddress.address_line),
    },
    bank_account: {
      bank_name: toTrimmedString(bankAccount.bank_name),
      bank_bin: toTrimmedString(bankAccount.bank_bin),
      bank_code: toTrimmedString(bankAccount.bank_code),
      account_number: toTrimmedString(bankAccount.account_number),
      account_holder: toTrimmedString(bankAccount.account_holder),
      qr_template: toTrimmedString(bankAccount.qr_template) || "compact",
    },
    vat: {
      enabled: toBoolean(vat.enabled),
      rate_percent: toNonNegativeNumber(vat.rate_percent, "defaults.vat.rate_percent"),
    },
    invoice: buildInvoicePayload(invoiceJson),
  };
};

export const SettingsService = {
  getGeneralSettings: async (
    tenantId: string | null,
    activeStoreId?: string | null,
  ): Promise<GeneralSettingsResponse> => {
    if (!tenantId) {
      return {
        tenant_id: null,
        defaults: buildDefaultsPayload({}, {}, {}, {}),
      };
    }

    const tenant = await SettingsRepository.findTenantDefaultsById(tenantId);

    if (!tenant) {
      return {
        tenant_id: tenantId,
        defaults: buildDefaultsPayload({}, {}, {}, {}),
      };
    }

    const defaults = buildDefaultsPayload(
      tenant.default_shipping_address_json,
      tenant.default_bank_account_json,
      tenant.default_vat_json,
      tenant.default_invoice_settings_json,
    );

    if (isShippingAddressEmpty(defaults.shipping_address) && activeStoreId) {
      const store = await SettingsRepository.findActiveStoreProfile(tenantId, activeStoreId);

      if (store) {
        defaults.shipping_address = buildShippingAddressFromStoreProfile(store.profile_json);
        const sellerDefaults = buildInvoiceDefaultsFromStore({
          profileJson: store.profile_json,
          billingAddressJson: store.billing_address_json,
          bankAccount: defaults.bank_account,
        });

        defaults.invoice.seller = {
          legal_name: defaults.invoice.seller.legal_name || sellerDefaults.legal_name,
          brand_name: defaults.invoice.seller.brand_name || sellerDefaults.brand_name,
          tax_code: defaults.invoice.seller.tax_code || sellerDefaults.tax_code,
          address_line: defaults.invoice.seller.address_line || sellerDefaults.address_line,
          email: defaults.invoice.seller.email || sellerDefaults.email,
          phone: defaults.invoice.seller.phone || sellerDefaults.phone,
        };
      }
    }

    return {
      tenant_id: tenant.id,
      defaults,
    };
  },

  updateGeneralSettings: async (
    tenantId: string | null,
    activeStoreId: string | null | undefined,
    input: UpdateGeneralSettingsInput,
  ): Promise<GeneralSettingsResponse> => {
    if (!tenantId) {
      throw new BadRequestError("Current user is not assigned to a tenant");
    }

    const current = await SettingsService.getGeneralSettings(tenantId, activeStoreId);
    const defaults = input.defaults ?? {};

    const nextShippingAddress = {
      ...current.defaults.shipping_address,
      ...toRecord(defaults.shipping_address),
    };
    const nextBankAccount = {
      ...current.defaults.bank_account,
      ...toRecord(defaults.bank_account),
    };
    const nextVat = {
      ...current.defaults.vat,
      ...toRecord(defaults.vat),
    };
    const nextInvoice = {
      ...current.defaults.invoice,
      ...toRecord(defaults.invoice),
      seller: {
        ...current.defaults.invoice.seller,
        ...toRecord(toRecord(defaults.invoice).seller),
      },
      numbering: {
        ...current.defaults.invoice.numbering,
        ...toRecord(toRecord(defaults.invoice).numbering),
      },
      display: {
        ...current.defaults.invoice.display,
        ...toRecord(toRecord(defaults.invoice).display),
      },
      compliance: {
        ...current.defaults.invoice.compliance,
        ...toRecord(toRecord(defaults.invoice).compliance),
      },
    };

    const normalizedShippingAddress = {
      contact_name: toTrimmedString(nextShippingAddress.contact_name),
      phone: toTrimmedString(nextShippingAddress.phone),
      state_id: toOptionalInt(nextShippingAddress.state_id, "defaults.shipping_address.state_id"),
      city_id: toOptionalInt(nextShippingAddress.city_id, "defaults.shipping_address.city_id"),
      district_id: toOptionalInt(nextShippingAddress.district_id, "defaults.shipping_address.district_id"),
      address_line: toTrimmedString(nextShippingAddress.address_line),
    };

    const normalizedBankAccount = {
      bank_name: toTrimmedString(nextBankAccount.bank_name),
      bank_bin: toTrimmedString(nextBankAccount.bank_bin),
      bank_code: toTrimmedString(nextBankAccount.bank_code),
      account_number: toTrimmedString(nextBankAccount.account_number),
      account_holder: toTrimmedString(nextBankAccount.account_holder),
      qr_template: toTrimmedString(nextBankAccount.qr_template) || "compact",
    };
    const normalizedVat = {
      enabled: toBoolean(nextVat.enabled),
      rate_percent: toNonNegativeNumber(nextVat.rate_percent, "defaults.vat.rate_percent"),
    };
    const normalizedInvoice = buildInvoicePayload(nextInvoice);

    const updated = await SettingsRepository.updateTenantDefaults({
      tenantId,
      shippingAddress: normalizedShippingAddress,
      bankAccount: normalizedBankAccount,
      vat: normalizedVat,
      invoice: normalizedInvoice,
    });

    if (activeStoreId) {
      const store = await SettingsRepository.findActiveStoreProfile(tenantId, activeStoreId);

      if (store) {
        const profile = toRecord(store.profile_json);

        await SettingsRepository.updateStoreProfile(activeStoreId, {
          ...profile,
          contact_phone:
            normalizedShippingAddress.phone || toTrimmedString(profile.contact_phone),
          state_id: normalizedShippingAddress.state_id,
          city_id: normalizedShippingAddress.city_id,
          district_id: normalizedShippingAddress.district_id,
          address_line: normalizedShippingAddress.address_line,
        });
      }
    }

    return {
      tenant_id: updated.id,
      defaults: buildDefaultsPayload(
        updated.default_shipping_address_json,
        updated.default_bank_account_json,
        updated.default_vat_json,
        updated.default_invoice_settings_json,
      ),
    };
  },

  getVietQrBanks: async () => {
    return VietQrService.getBanks();
  },

  getVietQrTemplates: async () => {
    return VietQrService.getTemplates();
  },

  generateVietQr: async (
    tenantId: string | null,
    input: VietQrGenerateInput,
  ): Promise<VietQrGenerateResponse> => {
    const settings = await SettingsService.getGeneralSettings(tenantId);

    return VietQrService.generateQr(input, settings.defaults.bank_account);
  },
};
