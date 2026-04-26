import { prisma } from "@lib/prisma";
import type { Prisma } from "../../../generated/prisma/client";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@/common";
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
  const existingStore = await prisma.store.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (existingStore && existingStore.id !== ignoreStoreId) {
    throw new ConflictError(`Store slug "${slug}" already exists`);
  }
};

const getUserStoreMembership = async (userId: string, storeId: string) => {
  const membership = await prisma.userStore.findUnique({
    where: {
      user_id_store_id: {
        user_id: userId,
        store_id: storeId,
      },
    },
    include: {
      store: true,
    },
  });

  if (!membership || membership.store.deleted_at) {
    throw new NotFoundError("Store not found");
  }

  return membership;
};

export const StoreService = {
  getUserStores: async (userId: string) => {
    const stores = await prisma.store.findMany({
      where: {
        deleted_at: null,
        user_stores: {
          some: {
            user_id: userId,
          },
        },
      },
      include: {
        user_stores: {
          where: {
            user_id: userId,
          },
          select: {
            role: true,
            user_id: true,
          },
        },
      },
      orderBy: [{ created_at: "asc" }],
    });

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
    while (await prisma.store.findUnique({ where: { slug: nextSlug }, select: { id: true } })) {
      suffix += 1;
      nextSlug = `${baseSlug}-${suffix}`;
    }

    const store = await prisma.$transaction(async (tx) => {
      const createdStore = await tx.store.create({
        data: {
          name,
          slug: nextSlug,
          tenant_id: user.tenant_id,
          owner_user_id: user.id,
          default_currency: toTrimmedString(input.currency) || DEFAULT_CURRENCY,
          default_timezone: toTrimmedString(input.timezone) || DEFAULT_TIMEZONE,
          user_stores: {
            create: {
              user_id: user.id,
              role: "owner",
            },
          },
        },
        include: {
          user_stores: {
            where: {
              user_id: user.id,
            },
            select: {
              role: true,
              user_id: true,
            },
          },
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          active_store_id: createdStore.id,
        },
      });

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

    const updated = await prisma.store.update({
      where: { id: storeId },
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
      include: {
        user_stores: {
          where: {
            user_id: userId,
          },
          select: {
            role: true,
            user_id: true,
          },
        },
      },
    });

    return mapStore(updated);
  },

  deleteStore: async (userId: string, storeId: string) => {
    const membership = await getUserStoreMembership(userId, storeId);

    if (membership.role !== "owner") {
      throw new ForbiddenError("Only the store owner can delete this store");
    }

    const userStoreCount = await prisma.userStore.count({
      where: {
        user_id: userId,
      },
    });

    if (userStoreCount <= 1) {
      throw new BadRequestError("You must keep at least one active store");
    }

    await prisma.$transaction(async (tx) => {
      await tx.store.update({
        where: { id: storeId },
        data: {
          deleted_at: new Date(),
        },
      });

      const fallbackMembership = await tx.userStore.findFirst({
        where: {
          user_id: userId,
          store_id: { not: storeId },
          store: {
            deleted_at: null,
          },
        },
        orderBy: [{ created_at: "asc" }],
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          active_store_id: fallbackMembership?.store_id ?? null,
        },
      });
    });

    return { deleted: true };
  },

  switchStore: async (userId: string, storeId: string) => {
    await getUserStoreMembership(userId, storeId);

    await prisma.user.update({
      where: { id: userId },
      data: {
        active_store_id: storeId,
      },
    });

    return StoreService.getStoreById(userId, storeId);
  },
};
