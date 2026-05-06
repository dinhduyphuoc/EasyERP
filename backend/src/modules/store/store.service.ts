import type { Prisma } from "../../../generated/prisma/client";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@/common";
import { StoreRepository } from "./store.repository";
import type { CreateStoreInput, UpdateStoreInput } from "./store.types";

const DEFAULT_CURRENCY = "USD";
const DEFAULT_TIMEZONE = "Asia/Saigon";
const DEFAULT_BUSINESS_TYPE = "individual";

const toTrimmedString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const toOptionalRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

const toJsonValue = (value: unknown): Prisma.InputJsonValue =>
  (toOptionalRecord(value) ?? {}) as Prisma.InputJsonValue;

const toOptionalInt = (value: unknown): number | null => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const buildStoreProfile = (value: unknown) => {
  const profile = toOptionalRecord(value) ?? {};

  return {
    business_type: toTrimmedString(profile.business_type) || DEFAULT_BUSINESS_TYPE,
    legal_full_name: toTrimmedString(profile.legal_full_name),
    contact_email: toTrimmedString(profile.contact_email),
    contact_phone: toTrimmedString(profile.contact_phone),
    avatar_url: toTrimmedString(profile.avatar_url),
    state_id: toOptionalInt(profile.state_id),
    city_id: toOptionalInt(profile.city_id),
    district_id: toOptionalInt(profile.district_id),
    address_line: toTrimmedString(profile.address_line),
  };
};

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);

const mapStore = (store: {
  id: string;
  name: string;
  slug: string;
  owner_user_id: string;
  default_currency: string;
  default_timezone: string;
  profile_json: unknown;
  default_address_json: unknown;
  billing_address_json: unknown;
  return_address_json: unknown;
  created_at: Date;
  updated_at: Date;
  user_stores?: Array<{ role: string; user_id: string }>;
}) => ({
  id: store.id,
  name: store.name,
  slug: store.slug,
  owner_user_id: store.owner_user_id,
  default_currency: store.default_currency,
  default_timezone: store.default_timezone,
  role: store.user_stores?.[0]?.role ?? "staff",
  profile: buildStoreProfile(store.profile_json),
  addresses: {
    default: toOptionalRecord(store.default_address_json) ?? {},
    billing: toOptionalRecord(store.billing_address_json) ?? {},
    return: toOptionalRecord(store.return_address_json) ?? {},
  },
  created_at: store.created_at.toISOString(),
  updated_at: store.updated_at.toISOString(),
});

const ensureSlugIsAvailable = async (slug: string, ignoreStoreId?: string) => {
  const existingStore = await StoreRepository.findStoreIdBySlug(slug);

  if (existingStore && existingStore.id !== ignoreStoreId) {
    throw new ConflictError(`Store slug "${slug}" already exists`);
  }
};

const getUserStoreMembership = async (userId: string, storeId: string) => {
  const membership = await StoreRepository.findUserStoreMembership(userId, storeId);

  if (!membership || membership.store.deleted_at) {
    throw new NotFoundError("Store not found");
  }

  return membership;
};

export const StoreService = {
  getUserStores: async (userId: string) => {
    const stores = await StoreRepository.findUserStores(userId);

    return stores.map(mapStore);
  },

  createStore: async (user: { id: string; tenant_id: string | null }, input: CreateStoreInput) => {
    const name = toTrimmedString(input.name);

    if (!name) {
      throw new BadRequestError("name is required");
    }

    const baseSlug = slugify(name);

    if (!baseSlug) {
      throw new BadRequestError("Unable to generate a valid slug from store name");
    }

    let nextSlug = baseSlug;
    let suffix = 1;
    while (await StoreRepository.findStoreIdBySlug(nextSlug)) {
      suffix += 1;
      nextSlug = `${baseSlug}-${suffix}`;
    }

    const store = await StoreRepository.withTransaction(async (tx) => {
      const createdStore = await StoreRepository.createStoreWithOwnerMembership(tx, {
        name,
        slug: nextSlug,
        tenantId: user.tenant_id,
        ownerUserId: user.id,
        defaultCurrency: toTrimmedString(input.currency) || DEFAULT_CURRENCY,
        defaultTimezone: toTrimmedString(input.timezone) || DEFAULT_TIMEZONE,
      });

      await StoreRepository.updateUserActiveStore(tx, user.id, createdStore.id);

      return createdStore;
    });

    return mapStore(store);
  },

  getStoreById: async (userId: string, storeId: string) => {
    const membership = await getUserStoreMembership(userId, storeId);
    return mapStore({
      ...membership.store,
      user_stores: [{ role: membership.role, user_id: membership.user_id }],
    });
  },

  updateStore: async (userId: string, storeId: string, input: UpdateStoreInput) => {
    const membership = await getUserStoreMembership(userId, storeId);

    if (!["owner", "admin"].includes(membership.role)) {
      throw new ForbiddenError("Only store owners or admins can update store settings");
    }

    const name = input.name === undefined ? membership.store.name : toTrimmedString(input.name);
    const slugInput = input.slug === undefined ? membership.store.slug : slugify(toTrimmedString(input.slug));

    if (!name) {
      throw new BadRequestError("name is required");
    }

    if (!slugInput) {
      throw new BadRequestError("slug is required");
    }

    await ensureSlugIsAvailable(slugInput, storeId);

    const updated = await StoreRepository.updateStoreWithMembership({
      storeId,
      userId,
      data: {
        name,
        slug: slugInput,
        default_currency:
          input.default_currency === undefined
            ? membership.store.default_currency
            : toTrimmedString(input.default_currency) || DEFAULT_CURRENCY,
        default_timezone:
          input.default_timezone === undefined
            ? membership.store.default_timezone
            : toTrimmedString(input.default_timezone) || DEFAULT_TIMEZONE,
        profile_json:
          input.profile === undefined
            ? toJsonValue(membership.store.profile_json)
            : (buildStoreProfile({
                ...buildStoreProfile(membership.store.profile_json),
                ...toOptionalRecord(input.profile),
              }) as Prisma.InputJsonValue),
        default_address_json:
          input.default_address === undefined
            ? toJsonValue(membership.store.default_address_json)
            : toJsonValue(input.default_address),
        billing_address_json:
          input.billing_address === undefined
            ? toJsonValue(membership.store.billing_address_json)
            : toJsonValue(input.billing_address),
        return_address_json:
          input.return_address === undefined
            ? toJsonValue(membership.store.return_address_json)
            : toJsonValue(input.return_address),
      },
    });

    return mapStore(updated);
  },

  deleteStore: async (userId: string, storeId: string) => {
    const membership = await getUserStoreMembership(userId, storeId);

    if (membership.role !== "owner") {
      throw new ForbiddenError("Only the store owner can delete this store");
    }

    const userStoreCount = await StoreRepository.countUserStores(userId);

    if (userStoreCount <= 1) {
      throw new BadRequestError("You must keep at least one active store");
    }

    await StoreRepository.withTransaction(async (tx) => {
      await StoreRepository.softDeleteStore(tx, storeId, new Date());

      const fallbackMembership = await StoreRepository.findFallbackMembership(tx, userId, storeId);

      await StoreRepository.updateUserActiveStore(tx, userId, fallbackMembership?.store_id ?? null);
    });

    return { deleted: true };
  },

  switchStore: async (userId: string, storeId: string) => {
    await getUserStoreMembership(userId, storeId);

    await StoreRepository.updateUserActiveStoreDirect(userId, storeId);

    return StoreService.getStoreById(userId, storeId);
  },
};
