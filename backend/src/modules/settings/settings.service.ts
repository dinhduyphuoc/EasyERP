import { BadRequestError } from "@/common";
import { VietQrService } from "@/lib/vietqr";
import { SettingsRepository } from "./settings.repository";
import type {
  GeneralSettingsResponse,
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

const buildDefaultsPayload = (
  shippingAddressJson: unknown,
  bankAccountJson: unknown,
  vatJson: unknown,
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
        defaults: buildDefaultsPayload({}, {}, {}),
      };
    }

    const tenant = await SettingsRepository.findTenantDefaultsById(tenantId);

    if (!tenant) {
      return {
        tenant_id: tenantId,
        defaults: buildDefaultsPayload({}, {}, {}),
      };
    }

    const defaults = buildDefaultsPayload(
      tenant.default_shipping_address_json,
      tenant.default_bank_account_json,
      tenant.default_vat_json,
    );

    if (isShippingAddressEmpty(defaults.shipping_address) && activeStoreId) {
      const store = await SettingsRepository.findActiveStoreProfile(tenantId, activeStoreId);

      if (store) {
        defaults.shipping_address = buildShippingAddressFromStoreProfile(store.profile_json);
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

    const updated = await SettingsRepository.updateTenantDefaults({
      tenantId,
      shippingAddress: normalizedShippingAddress,
      bankAccount: normalizedBankAccount,
      vat: normalizedVat,
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
