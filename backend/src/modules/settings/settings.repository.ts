import { prisma } from "@lib/prisma";
import type { Prisma } from "../../../generated/prisma/client";

export const SettingsRepository = {
  findTenantDefaultsById: (tenantId: string) =>
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        default_shipping_address_json: true,
        default_bank_account_json: true,
        default_vat_json: true,
        default_invoice_settings_json: true,
      },
    }),

  findActiveStoreProfile: (tenantId: string, activeStoreId: string) =>
    prisma.store.findFirst({
      where: {
        id: activeStoreId,
        tenant_id: tenantId,
        deleted_at: null,
      },
      select: {
        profile_json: true,
        billing_address_json: true,
      },
    }),

  updateTenantDefaults: (args: {
    tenantId: string;
    shippingAddress: Prisma.InputJsonValue;
    bankAccount: Prisma.InputJsonValue;
    vat: Prisma.InputJsonValue;
    invoice: Prisma.InputJsonValue;
  }) =>
    prisma.tenant.update({
      where: { id: args.tenantId },
      data: {
        default_shipping_address_json: args.shippingAddress,
        default_bank_account_json: args.bankAccount,
        default_vat_json: args.vat,
        default_invoice_settings_json: args.invoice,
      },
      select: {
        id: true,
        default_shipping_address_json: true,
        default_bank_account_json: true,
        default_vat_json: true,
        default_invoice_settings_json: true,
      },
    }),

  updateStoreProfile: (storeId: string, profile: Prisma.InputJsonValue) =>
    prisma.store.update({
      where: { id: storeId },
      data: {
        profile_json: profile,
      },
    }),
};
