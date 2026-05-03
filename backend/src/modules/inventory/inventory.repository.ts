import { prisma } from "@lib/prisma";
import { Prisma } from "../../../generated/prisma/client";

export type InventoryTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
export type InventoryDbClient = typeof prisma | InventoryTransaction;

export const INVENTORY_AUDIT_INCLUDE = {
  lines: {
    orderBy: { id: "asc" },
    include: {
      product_variant: {
        include: {
          product: {
            select: {
              id: true,
              product_name: true,
              unit: true,
              image_url: true,
              status: true,
            },
          },
          attribute_values: {
            include: {
              attribute_value: {
                select: {
                  value: true,
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.InventoryAuditInclude;

export const INVENTORY_AUDIT_LIST_SELECT = {
  id: true,
  audit_code: true,
  status: true,
  note: true,
  account_id: true,
  account_name: true,
  counted_at: true,
  completed_at: true,
  created_at: true,
  updated_at: true,
  lines: {
    select: {
      counted_on_hand: true,
      delta_qty: true,
    },
    orderBy: { id: "asc" },
  },
} satisfies Prisma.InventoryAuditSelect;

export const INVENTORY_STOCK_LIST_SELECT = {
  sku: true,
  selling_price: true,
  cogs: true,
  image_url: true,
  product: {
    select: {
      id: true,
      product_name: true,
      unit: true,
      image_url: true,
      status: true,
    },
  },
  attribute_values: {
    select: {
      attribute_value: {
        select: {
          value: true,
        },
      },
    },
  },
  inventory_stock: {
    select: {
      on_hand: true,
      available: true,
      committed: true,
      packing: true,
      incoming: true,
    },
  },
} satisfies Prisma.ProductVariantSelect;

export type InventoryVariantStockRecord = Prisma.ProductVariantGetPayload<{
  select: typeof INVENTORY_STOCK_LIST_SELECT;
}>;

export type InventoryAuditRecord = Prisma.InventoryAuditGetPayload<{
  include: typeof INVENTORY_AUDIT_INCLUDE;
}>;

export type InventoryAuditListRecord = Prisma.InventoryAuditGetPayload<{
  select: typeof INVENTORY_AUDIT_LIST_SELECT;
}>;

export type InventoryTransactionRecord = Prisma.InventoryTransactionGetPayload<{
  include: {
    lines: {
      orderBy: { id: "asc" };
    };
  };
}>;

export type LockedInventoryStockRow = {
  id: number;
  product_variant_id: string;
  on_hand: number;
  available: number;
  committed: number;
  packing: number;
  incoming: number;
  version: number;
  created_at: Date;
  updated_at: Date;
};

export const InventoryRepository = {
  withTransaction: <T>(
    fn: (tx: InventoryTransaction) => Promise<T>,
    options?: { maxWait?: number; timeout?: number },
  ) => prisma.$transaction(fn, options),

  findVariantBySkuBasic: (db: InventoryDbClient, sku: string) =>
    db.productVariant.findUnique({
      where: { sku },
      select: {
        sku: true,
        store_id: true,
      },
    }),

  findVariantBySkuBasicGlobal: (sku: string) =>
    prisma.productVariant.findUnique({
      where: { sku },
      select: {
        sku: true,
        store_id: true,
      },
    }),

  findIdempotentTransaction: (tx: InventoryTransaction, idempotencyKey: string) =>
    tx.inventoryTransaction.findUnique({
      where: { idempotency_key: idempotencyKey },
      include: { lines: true },
    }),

  lockStockByVariantId: (tx: InventoryTransaction, productVariantId: string) =>
    tx.$queryRaw<LockedInventoryStockRow[]>`
      SELECT id, product_variant_id, on_hand, available, committed, packing, incoming, version, created_at, updated_at
      FROM "InventoryStock"
      WHERE product_variant_id = ${productVariantId}
      FOR UPDATE
    `,

  findInventoryTransactionWithLinesByIdOrThrow: (tx: InventoryTransaction, id: number) =>
    tx.inventoryTransaction.findUniqueOrThrow({
      where: { id },
      include: { lines: true },
    }),

  findInventoryStockByVariantIdOrThrow: (tx: InventoryTransaction, productVariantId: string) =>
    tx.inventoryStock.findUniqueOrThrow({
      where: { product_variant_id: productVariantId },
    }),

  findLatestAuditId: (tx: InventoryTransaction) =>
    tx.inventoryAudit.findFirst({
      orderBy: { id: "desc" },
      select: { id: true },
    }),

  findAuditCodeConflict: (
    tx: InventoryTransaction,
    storeId: string,
    auditCode: string,
    ignoreAuditId?: number,
  ) =>
    tx.inventoryAudit.findFirst({
      where: {
        store_id: storeId,
        audit_code: auditCode,
        ...(ignoreAuditId ? { id: { not: ignoreAuditId } } : {}),
      },
      select: { id: true },
    }),

  findVariantStocks: (
    tx: InventoryTransaction,
    productVariantIds: string[],
    storeId?: string,
  ) =>
    tx.productVariant.findMany({
      where: {
        sku: { in: productVariantIds },
        ...(storeId ? { store_id: storeId } : {}),
      },
      select: {
        sku: true,
        inventory_stock: {
          select: {
            on_hand: true,
          },
        },
      },
    }),

  findStockList: (storeId: string, search?: string) =>
    prisma.productVariant.findMany({
      where: {
        status: {
          not: "deleted",
        },
        product: {
          status: {
            not: "deleted",
          },
        },
        store_id: storeId,
        ...(search
          ? {
              OR: [
                { sku: { contains: search, mode: "insensitive" } },
                {
                  product: {
                    product_name: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                },
                {
                  attribute_values: {
                    some: {
                      attribute_value: {
                        value: {
                          contains: search,
                          mode: "insensitive",
                        },
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      select: INVENTORY_STOCK_LIST_SELECT,
      orderBy: [{ product: { product_name: "asc" } }, { sku: "asc" }],
    }),

  findStockItem: (storeId: string, variantId: string) =>
    prisma.productVariant.findFirst({
      where: {
        sku: variantId,
        store_id: storeId,
        status: {
          not: "deleted",
        },
        product: {
          status: {
            not: "deleted",
          },
        },
      },
      select: INVENTORY_STOCK_LIST_SELECT,
    }),

  findAuditList: (storeId: string, search?: string, status?: "draft" | "completed") =>
    prisma.inventoryAudit.findMany({
      where: {
        store_id: storeId,
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { audit_code: { contains: search, mode: "insensitive" } },
                { note: { contains: search, mode: "insensitive" } },
                { account_name: { contains: search, mode: "insensitive" } },
                {
                  lines: {
                    some: {
                      product_variant_id: {
                        contains: search,
                        mode: "insensitive",
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      select: INVENTORY_AUDIT_LIST_SELECT,
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
    }),

  findAuditById: (storeId: string, id: number) =>
    prisma.inventoryAudit.findFirst({
      where: {
        id,
        store_id: storeId,
      },
      include: INVENTORY_AUDIT_INCLUDE,
    }),

  createAudit: (tx: InventoryTransaction, data: Prisma.InventoryAuditUncheckedCreateInput) =>
    tx.inventoryAudit.create({
      data,
      include: INVENTORY_AUDIT_INCLUDE,
    }),

  findAuditForUpdate: (tx: InventoryTransaction, storeId: string, id: number) =>
    tx.inventoryAudit.findFirst({
      where: {
        id,
        store_id: storeId,
      },
      include: {
        lines: {
          orderBy: { id: "asc" },
        },
      },
    }),

  deleteAuditLinesByAuditId: (tx: InventoryTransaction, auditId: number) =>
    tx.inventoryAuditLine.deleteMany({
      where: { audit_id: auditId },
    }),

  updateAudit: (
    tx: InventoryTransaction,
    id: number,
    data: Prisma.InventoryAuditUpdateInput,
  ) =>
    tx.inventoryAudit.update({
      where: { id },
      data,
      include: INVENTORY_AUDIT_INCLUDE,
    }),

  findAuditStatusById: (tx: InventoryTransaction, storeId: string, id: number) =>
    tx.inventoryAudit.findFirst({
      where: {
        id,
        store_id: storeId,
      },
      select: {
        id: true,
        status: true,
      },
    }),

  deleteAuditById: (tx: InventoryTransaction, id: number) =>
    tx.inventoryAudit.delete({
      where: { id },
    }),

  findAuditWithLinesById: (tx: InventoryTransaction, storeId: string, id: number) =>
    tx.inventoryAudit.findFirst({
      where: {
        id,
        store_id: storeId,
      },
      include: {
        lines: {
          orderBy: { id: "asc" },
        },
      },
    }),

  findInventoryStockByVariantId: (productVariantId: string) =>
    prisma.inventoryStock.findUnique({
      where: { product_variant_id: productVariantId },
    }),

  findInventoryHistory: (
    storeId: string,
    productVariantId: string,
    limit: number,
    cursor?: number,
  ) =>
    prisma.inventoryTransaction.findMany({
      where: {
        store_id: storeId,
        product_variant_id: productVariantId,
      },
      include: {
        lines: {
          orderBy: { id: "asc" },
        },
      },
      orderBy: { id: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),

  findInventoryStockExists: (tx: InventoryTransaction, productVariantId: string) =>
    tx.inventoryStock.findUnique({
      where: { product_variant_id: productVariantId },
      select: { id: true },
    }),

  createInventoryStock: (tx: InventoryTransaction, data: Prisma.InventoryStockUncheckedCreateInput) =>
    tx.inventoryStock.create({
      data,
    }),

  createInventoryTransaction: (
    tx: InventoryTransaction,
    data: Prisma.InventoryTransactionUncheckedCreateInput,
  ) =>
    tx.inventoryTransaction.create({
      data,
    }),

  updateInventoryStockBuckets: (
    tx: InventoryTransaction,
    productVariantId: string,
    data: {
      store_id: string;
      on_hand: number;
      available: number;
      committed: number;
      packing: number;
      incoming: number;
    },
  ) =>
    tx.inventoryStock.update({
      where: { product_variant_id: productVariantId },
      data: {
        ...data,
        version: { increment: 1 },
      },
    }),
};
