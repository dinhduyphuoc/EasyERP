import { BadRequestError } from "@/common";
import { prisma } from "@lib/prisma";
import { VietQrService } from "@/lib/vietqr";
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

const buildDefaultsPayload = (
  shippingAddressJson: unknown,
  bankAccountJson: unknown,
): GeneralSettingsResponse["defaults"] => {
  const shippingAddress = toRecord(shippingAddressJson);
  const bankAccount = toRecord(bankAccountJson);

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
  };
};

export const SettingsService = {
  getGeneralSettings: async (tenantId: string | null): Promise<GeneralSettingsResponse> => {
    if (!tenantId) {
      return {
        tenant_id: null,
        defaults: buildDefaultsPayload({}, {}),
      };
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        default_shipping_address_json: true,
        default_bank_account_json: true,
      },
    });

    if (!tenant) {
      return {
        tenant_id: tenantId,
        defaults: buildDefaultsPayload({}, {}),
      };
    }

    return {
      tenant_id: tenant.id,
      defaults: buildDefaultsPayload(
        tenant.default_shipping_address_json,
        tenant.default_bank_account_json,
      ),
    };
  },

  updateGeneralSettings: async (
    tenantId: string | null,
    input: UpdateGeneralSettingsInput,
  ): Promise<GeneralSettingsResponse> => {
    if (!tenantId) {
      throw new BadRequestError("Current user is not assigned to a tenant");
    }

    const current = await SettingsService.getGeneralSettings(tenantId);
    const defaults = input.defaults ?? {};

    const nextShippingAddress = {
      ...current.defaults.shipping_address,
      ...toRecord(defaults.shipping_address),
    };
    const nextBankAccount = {
      ...current.defaults.bank_account,
      ...toRecord(defaults.bank_account),
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

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        default_shipping_address_json: normalizedShippingAddress,
        default_bank_account_json: normalizedBankAccount,
      },
      select: {
        id: true,
        default_shipping_address_json: true,
        default_bank_account_json: true,
      },
    });

    return {
      tenant_id: updated.id,
      defaults: buildDefaultsPayload(
        updated.default_shipping_address_json,
        updated.default_bank_account_json,
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
