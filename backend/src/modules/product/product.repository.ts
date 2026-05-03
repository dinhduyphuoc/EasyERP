import { prisma } from "@lib/prisma";
import { Prisma } from "../../../generated/prisma/client";

export type ProductTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type ProductDbClient = typeof prisma | ProductTransaction;

const PRODUCT_INCLUDE = {
  attributes: { include: { values: true } },
  variants: {
    where: {
      status: "active",
    },
    include: {
      attribute_values: {
        include: {
          attribute_value: true,
        },
      },
    },
  },
} as const;

const PRODUCT_LIST_SELECT = {
  id: true,
  product_name: true,
  default_variant_sku: true,
  image_url: true,
  status: true,
  category_id: true,
  variants: {
    where: {
      status: "active",
    },
    select: {
      sku: true,
      kind: true,
      selling_price: true,
      image_url: true,
    },
    orderBy: [{ sku: "asc" as const }],
  },
} satisfies Prisma.ProductSelect;

export type ProductDetailRecord = Prisma.ProductGetPayload<{
  include: typeof PRODUCT_INCLUDE;
}>;

export type ProductListRecord = Prisma.ProductGetPayload<{
  select: typeof PRODUCT_LIST_SELECT;
}>;

export const ProductRepository = {
  withTransaction: <T>(
    fn: (tx: ProductTransaction) => Promise<T>,
    options: { maxWait: number; timeout: number },
  ) => prisma.$transaction(fn, options),

  findCategories: (storeId: string) =>
    prisma.category.findMany({
      select: {
        id: true,
        category_name: true,
      },
      where: {
        store_id: storeId,
      },
      orderBy: {
        category_name: "asc",
      },
    }),

  findCategoryById: (storeId: string, id: number) =>
    prisma.category.findFirst({
      where: { id, store_id: storeId },
      select: {
        id: true,
        category_name: true,
      },
    }),

  findCategoryNameConflict: (
    db: ProductDbClient,
    storeId: string,
    categoryName: string,
    ignoreCategoryId?: number,
  ) =>
    db.category.findFirst({
      where: {
        store_id: storeId,
        category_name: categoryName,
        ...(ignoreCategoryId ? { id: { not: ignoreCategoryId } } : {}),
      },
      select: {
        id: true,
      },
    }),

  createCategory: (tx: ProductTransaction, storeId: string, categoryName: string) =>
    tx.category.create({
      data: {
        category_name: categoryName,
        store_id: storeId,
      },
      select: {
        id: true,
        category_name: true,
      },
    }),

  updateCategory: (tx: ProductTransaction, id: number, categoryName: string) =>
    tx.category.update({
      where: { id },
      data: {
        category_name: categoryName,
      },
      select: {
        id: true,
        category_name: true,
      },
    }),

  findCategoriesByIds: (tx: ProductTransaction, storeId: string, ids: number[]) =>
    tx.category.findMany({
      where: { id: { in: ids }, store_id: storeId },
      select: { id: true, category_name: true },
    }),

  findLinkedProductsByCategoryIds: (tx: ProductTransaction, storeId: string, ids: number[]) =>
    tx.product.findMany({
      where: {
        category_id: { in: ids },
        store_id: storeId,
        status: {
          not: "deleted",
        },
      },
      select: { product_name: true, category_id: true },
      take: 5,
    }),

  deleteCategories: (tx: ProductTransaction, storeId: string, ids: number[]) =>
    tx.category.deleteMany({
      where: { id: { in: ids }, store_id: storeId },
    }),

  findCategoryByStoreAndId: (tx: ProductTransaction, storeId: string, id: number) =>
    tx.category.findFirst({
      where: { id, store_id: storeId },
      select: { id: true },
    }),

  findCategoryIdByStoreAndName: (tx: ProductTransaction, storeId: string, categoryName: string) =>
    tx.category.findFirst({
      where: { category_name: categoryName, store_id: storeId },
      select: { id: true },
    }),

  findProductDetailOrThrow: async (storeId: string, id: number) => {
    const product = await prisma.product.findFirst({
      where: { id, store_id: storeId },
      include: PRODUCT_INCLUDE,
    });

    return product;
  },

  findProductsForList: (args: {
    storeId: string;
    where: Prisma.ProductWhereInput;
    skip?: number;
    take?: number;
  }) =>
    prisma.product.findMany({
      where: args.where,
      select: PRODUCT_LIST_SELECT,
      orderBy: [{ product_name: "asc" }, { id: "asc" }],
      ...(args.skip !== undefined && args.take !== undefined
        ? {
            skip: args.skip,
            take: args.take,
          }
        : {}),
    }),

  findSoftDeletedProductByDefaultSku: (
    tx: ProductTransaction,
    storeId: string,
    defaultVariantSku: string,
  ) =>
    tx.product.findFirst({
      where: {
        default_variant_sku: defaultVariantSku,
        status: "deleted",
        store_id: storeId,
      },
      include: PRODUCT_INCLUDE,
    }),

  findProductVariantSkus: (tx: ProductTransaction, productId: number) =>
    tx.productVariant.findMany({
      where: { product_id: productId },
      select: { sku: true },
    }),

  updateProductRecord: (
    tx: ProductTransaction,
    productId: number,
    data: Prisma.ProductUncheckedUpdateInput,
  ) =>
    tx.product.update({
      where: { id: productId },
      data,
    }),

  deleteAttributeValueLinksByProductId: (tx: ProductTransaction, productId: number) =>
    tx.attributeValue.deleteMany({
      where: { attribute: { product_id: productId } },
    }),

  deleteAttributesByProductId: (tx: ProductTransaction, productId: number) =>
    tx.attribute.deleteMany({
      where: { product_id: productId },
    }),

  createAttribute: (
    tx: ProductTransaction,
    productId: number,
    attribute: {
      name: string;
      values: string[];
    },
  ) =>
    tx.attribute.create({
      data: {
        name: attribute.name,
        product_id: productId,
        values: {
          create: attribute.values.map((value) => ({ value })),
        },
      },
    }),

  findAttributesWithValuesByProductId: (tx: ProductTransaction, productId: number) =>
    tx.attribute.findMany({
      where: { product_id: productId },
      include: { values: true },
    }),

  findProductDetailByIdOrThrowInTx: (tx: ProductTransaction, productId: number) =>
    tx.product.findUniqueOrThrow({
      where: { id: productId },
      include: PRODUCT_INCLUDE,
    }),

  findVariantSkuConflict: (
    tx: ProductTransaction,
    storeId: string,
    productId: number,
    variantSkus: string[],
  ) =>
    tx.productVariant.findFirst({
      where: {
        sku: { in: variantSkus },
        product_id: { not: productId },
        store_id: storeId,
      },
    }),

  findVariantStoreBySku: (tx: ProductTransaction, productVariantId: string) =>
    tx.productVariant.findUnique({
      where: { sku: productVariantId },
      select: {
        store_id: true,
      },
    }),

  upsertInventoryStock: (tx: ProductTransaction, productVariantId: string, storeId: string) =>
    tx.inventoryStock.upsert({
      where: { product_variant_id: productVariantId },
      update: {
        store_id: storeId,
      },
      create: {
        store_id: storeId,
        product_variant_id: productVariantId,
        on_hand: 0,
        available: 0,
        committed: 0,
        packing: 0,
        incoming: 0,
        version: 0,
      },
    }),

  resetInventoryStocks: (tx: ProductTransaction, variantSkus: string[]) =>
    tx.inventoryStock.updateMany({
      where: {
        product_variant_id: { in: variantSkus },
      },
      data: {
        on_hand: 0,
        available: 0,
        committed: 0,
        packing: 0,
        incoming: 0,
        version: {
          increment: 1,
        },
      },
    }),

  deleteVariantAttributeLinks: (tx: ProductTransaction, variantSkus: string[]) =>
    tx.variantAttributeValue.deleteMany({
      where: {
        variant_sku: { in: variantSkus },
      },
    }),

  findExistingVariants: (tx: ProductTransaction, productId: number) =>
    tx.productVariant.findMany({
      where: { product_id: productId },
      select: {
        sku: true,
        kind: true,
      },
    }),

  deactivateVariants: (tx: ProductTransaction, skus: string[]) =>
    tx.productVariant.updateMany({
      where: { sku: { in: skus } },
      data: { status: "inactive" },
    }),

  markVariantsDeleted: (tx: ProductTransaction, skus: string[]) =>
    tx.productVariant.updateMany({
      where: { sku: { in: skus } },
      data: { status: "deleted" },
    }),

  updateVariant: (
    tx: ProductTransaction,
    sku: string,
    data: Prisma.ProductVariantUncheckedUpdateInput,
  ) =>
    tx.productVariant.update({
      where: { sku },
      data,
    }),

  createVariant: (tx: ProductTransaction, data: Prisma.ProductVariantUncheckedCreateInput) =>
    tx.productVariant.create({
      data,
    }),

  createProductWithAttributes: (
    tx: ProductTransaction,
    data: Prisma.ProductUncheckedCreateInput & {
      attributes?: Prisma.AttributeCreateNestedManyWithoutProductInput;
    },
  ) =>
    tx.product.create({
      data,
      include: { attributes: { include: { values: true } } },
    }),

  findProductForEdit: (tx: ProductTransaction, storeId: string, id: number) =>
    tx.product.findFirst({
      where: { id, store_id: storeId },
      include: {
        variants: {
          select: { sku: true },
        },
      },
    }),

  updateProductWithAttributes: (
    tx: ProductTransaction,
    productId: number,
    data: Prisma.ProductUncheckedUpdateInput & {
      attributes?: Prisma.AttributeUpdateManyWithoutProductNestedInput;
    },
  ) =>
    tx.product.update({
      where: { id: productId },
      data,
      include: { attributes: { include: { values: true } } },
    }),

  findProductsByIds: (tx: ProductTransaction, storeId: string, ids: number[]) =>
    tx.product.findMany({
      where: { id: { in: ids }, store_id: storeId },
      select: {
        id: true,
        status: true,
      },
    }),

  findVariantSkusByProductIds: (tx: ProductTransaction, storeId: string, productIds: number[]) =>
    tx.productVariant.findMany({
      where: { store_id: storeId, product_id: { in: productIds } },
      select: { sku: true },
    }),

  markProductsDeleted: (tx: ProductTransaction, storeId: string, productIds: number[]) =>
    tx.product.updateMany({
      where: { id: { in: productIds }, store_id: storeId },
      data: { status: "deleted" },
    }),

  markProductVariantsDeletedByProductIds: (
    tx: ProductTransaction,
    storeId: string,
    productIds: number[],
  ) =>
    tx.productVariant.updateMany({
      where: { store_id: storeId, product_id: { in: productIds } },
      data: { status: "deleted" },
    }),
};
