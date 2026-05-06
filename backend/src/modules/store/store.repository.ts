import { prisma } from "@lib/prisma";
import type { Prisma } from "../../../generated/prisma/client";

export type StoreTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type StoreDbClient = typeof prisma | StoreTransaction;

export const StoreRepository = {
  findStoreIdBySlug: (slug: string) =>
    prisma.store.findUnique({
      where: { slug },
      select: { id: true },
    }),

  findUserStoreMembership: (userId: string, storeId: string) =>
    prisma.userStore.findUnique({
      where: {
        user_id_store_id: {
          user_id: userId,
          store_id: storeId,
        },
      },
      include: {
        store: true,
      },
    }),

  findUserStores: (userId: string) =>
    prisma.store.findMany({
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
    }),

  withTransaction: <T>(
    fn: (tx: StoreTransaction) => Promise<T>,
    options?: Parameters<typeof prisma.$transaction>[1],
  ) => prisma.$transaction(fn, options),

  createStoreWithOwnerMembership: (tx: StoreTransaction, args: {
    name: string;
    slug: string;
    tenantId: string | null;
    ownerUserId: string;
    defaultCurrency: string;
    defaultTimezone: string;
  }) =>
    tx.store.create({
      data: {
        name: args.name,
        slug: args.slug,
        tenant_id: args.tenantId,
        owner_user_id: args.ownerUserId,
        default_currency: args.defaultCurrency,
        default_timezone: args.defaultTimezone,
        user_stores: {
          create: {
            user_id: args.ownerUserId,
            role: "owner",
          },
        },
      },
      include: {
        user_stores: {
          where: {
            user_id: args.ownerUserId,
          },
          select: {
            role: true,
            user_id: true,
          },
        },
      },
    }),

  updateUserActiveStore: (db: StoreDbClient, userId: string, storeId: string | null) =>
    db.user.update({
      where: { id: userId },
      data: {
        active_store_id: storeId,
      },
    }),

  updateUserActiveStoreDirect: (userId: string, storeId: string | null) =>
    prisma.user.update({
      where: { id: userId },
      data: {
        active_store_id: storeId,
      },
    }),

  updateStoreWithMembership: (args: {
    storeId: string;
    userId: string;
    data: Prisma.StoreUpdateInput;
  }) =>
    prisma.store.update({
      where: { id: args.storeId },
      data: args.data,
      include: {
        user_stores: {
          where: {
            user_id: args.userId,
          },
          select: {
            role: true,
            user_id: true,
          },
        },
      },
    }),

  countUserStores: (userId: string) =>
    prisma.userStore.count({
      where: {
        user_id: userId,
      },
    }),

  softDeleteStore: (tx: StoreTransaction, storeId: string, deletedAt: Date) =>
    tx.store.update({
      where: { id: storeId },
      data: {
        deleted_at: deletedAt,
      },
    }),

  findFallbackMembership: (tx: StoreTransaction, userId: string, storeIdToExclude: string) =>
    tx.userStore.findFirst({
      where: {
        user_id: userId,
        store_id: { not: storeIdToExclude },
        store: {
          deleted_at: null,
        },
      },
      orderBy: [{ created_at: "asc" }],
    }),
};
