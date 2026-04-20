import { prisma } from "@lib/prisma";
import { deleteManagedProductImageFromS3 } from "@lib/s3";
import { BadRequestError, ConflictError, NotFoundError } from "@/common";
import type {
  ProductCategoryItem,
  ProductCategoryRequestInput,
  ProductInput,
  ProductRequestInput,
  ProductStatusInput,
} from "./product.types";

type PrismaTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const CATEGORY_CACHE_TTL_MS = 5 * 60 * 1000;

let categoryCache:
  | {
      data: ProductCategoryItem[];
      expiresAt: number;
    }
  | null = null;

const clearCategoryCache = () => {
  categoryCache = null;
};

const getUniqueIds = (ids: number[]) => [...new Set(ids)];

const normalizeCategoryName = (value: unknown) => {
  const categoryName = toOptionalTrimmedString(value);

  if (!categoryName) {
    throw new BadRequestError("category_name is required");
  }

  return categoryName;
};

const ensureCategoryNameIsUnique = async (
  tx: PrismaTransaction | typeof prisma,
  categoryName: string,
  ignoreCategoryId?: number,
) => {
  const existingCategory = await tx.category.findFirst({
    where: {
      category_name: categoryName,
      ...(ignoreCategoryId ? { id: { not: ignoreCategoryId } } : {}),
    },
    select: {
      id: true,
    },
  });

  if (existingCategory) {
    throw new ConflictError(`Category "${categoryName}" already exists`);
  }
};

const productInclude = {
  attributes: { include: { values: true } },
  variants: {
    where: {
      status: {
        not: "deleted",
      },
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

const toOptionalTrimmedString = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const toNullableTrimmedString = (value: unknown) => {
  if (value === null) {
    return undefined;
  }

  return toOptionalTrimmedString(value);
};

const toOptionalTrimmedStringOrNull = (value: unknown) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return toOptionalTrimmedString(value);
};

const toOptionalNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(normalized) ? normalized : undefined;
  }

  return undefined;
};

const PRODUCT_STATUSES: ProductStatusInput[] = ["active", "inactive", "draft", "deleted"];

const normalizeProductStatus = (value: unknown): ProductStatusInput => {
  if (value === undefined || value === null || value === "") {
    return "draft";
  }

  if (typeof value !== "string") {
    throw new BadRequestError("status is invalid");
  }

  if (PRODUCT_STATUSES.includes(value as ProductStatusInput)) {
    return value as ProductStatusInput;
  }

  throw new BadRequestError("status must be one of: active, inactive, draft, deleted");
};

const normalizeAttributeInputs = (attributes: ProductRequestInput["attributes"]) =>
  (attributes ?? [])
    .map((attribute) => ({
      name: attribute.name.trim(),
      values: [...new Set(attribute.values.map((value) => value.trim()).filter(Boolean))],
    }))
    .filter((attribute) => attribute.name && attribute.values.length > 0);

const normalizeVariantCombinations = (
  variant: NonNullable<ProductRequestInput["variants"]>[number],
) => {
  const directCombinations = (variant.combinations ?? [])
    .map((combination) => combination.trim())
    .filter(Boolean);

  if (directCombinations.length > 0) {
    return directCombinations;
  }

  const derivedCombinations = (variant.name ?? "")
    .split("/")
    .map((value) => value.trim())
    .filter(Boolean);

  return derivedCombinations;
};

const ensureUniqueValues = (values: string[], fieldName: string) => {
  const unique = new Set(values);

  if (unique.size !== values.length) {
    throw new BadRequestError(`${fieldName} contains duplicated values`);
  }
};

const toProductData = (data: ProductInput) => ({
  product_name: data.product_name,
  sku: data.sku,
  unit: data.unit,
  base_price: data.base_price,
  cogs: data.cogs,
  image_url: data.image_url,
  status: data.status,
  description: data.description,
  created_at: data.created_at ? new Date(data.created_at) : undefined,
  category_id: data.category_id,
});

const toAttributeCreateData = (attributes: ProductInput["attributes"]) =>
  attributes.length
    ? {
        create: attributes.map((attribute) => ({
          name: attribute.name,
          values: {
            create: attribute.values.map((value) => ({ value })),
          },
        })),
      }
    : undefined;

const buildAttributeValueMap = (
  attributes: Array<{
    values: Array<{ id: number; value: string }>;
  }>,
) => {
  const map = new Map<string, number>();

  for (const attribute of attributes) {
    for (const attributeValue of attribute.values) {
      if (map.has(attributeValue.value)) {
        throw new BadRequestError(
          `Duplicate attribute value "${attributeValue.value}" is not supported across attributes`,
        );
      }

      map.set(attributeValue.value, attributeValue.id);
    }
  }

  return map;
};

const resolveAttributeValueIds = (
  combinations: string[],
  attributeValueMap: Map<string, number>,
) => {
  return combinations.map((combination) => {
    const attributeValueId = attributeValueMap.get(combination);

    if (!attributeValueId) {
      throw new BadRequestError(
        `Combination value "${combination}" does not exist in product attributes`,
      );
    }

    return attributeValueId;
  });
};

const createVariantAttributeValues = (attributeValueIds: number[]) =>
  attributeValueIds.length
    ? {
        create: attributeValueIds.map((attributeValueId) => ({
          attribute_value_id: attributeValueId,
        })),
      }
    : undefined;

const ensureNoCrossProductSkuConflict = async (
  tx: PrismaTransaction,
  productId: number,
  variantSkus: string[],
) => {
  if (!variantSkus.length) {
    return;
  }

  const conflictingVariant = await tx.productVariant.findFirst({
    where: {
      sku: { in: variantSkus },
      product_id: { not: productId },
    },
  });

  if (conflictingVariant) {
    throw new ConflictError(`SKU "${conflictingVariant.sku}" already belongs to another product`);
  }
};

const ensureInventoryStockExists = async (
  tx: PrismaTransaction,
  productVariantId: string,
) => {
  await tx.inventoryStock.upsert({
    where: { product_variant_id: productVariantId },
    update: {},
    create: {
      product_variant_id: productVariantId,
      on_hand: 0,
      available: 0,
      committed: 0,
      packing: 0,
      incoming: 0,
      version: 0,
    },
  });
};

const resetInventoryStocks = async (
  tx: PrismaTransaction,
  variantSkus: string[],
) => {
  if (variantSkus.length === 0) {
    return;
  }

  await tx.inventoryStock.updateMany({
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
  });
};

const getProductVariantSkus = async (tx: PrismaTransaction, productId: number) => {
  const variants = await tx.productVariant.findMany({
    where: { product_id: productId },
    select: { sku: true },
  });

  return variants.map((variant) => variant.sku);
};

const deleteVariantAttributeLinks = async (
  tx: PrismaTransaction,
  variantSkus: string[],
) => {
  if (variantSkus.length === 0) {
    return;
  }

  await tx.variantAttributeValue.deleteMany({
    where: {
      variant_sku: { in: variantSkus },
    },
  });
};

const syncVariants = async (
  tx: PrismaTransaction,
  productId: number,
  variants: ProductInput["variants"],
  attributeValueMap: Map<string, number>,
) => {
  const existingVariants = await tx.productVariant.findMany({
    where: { product_id: productId },
    select: { sku: true },
  });
  const existingSkuSet = new Set(existingVariants.map((variant) => variant.sku));
  const nextSkuSet = new Set(variants.map((variant) => variant.sku));
  const removedSkus = existingVariants
    .map((variant) => variant.sku)
    .filter((sku) => !nextSkuSet.has(sku));

  if (removedSkus.length > 0) {
    await resetInventoryStocks(tx, removedSkus);
    await tx.productVariant.updateMany({
      where: { sku: { in: removedSkus } },
      data: { status: "deleted" },
    });
  }

  for (const variant of variants) {
    const attributeValueIds = resolveAttributeValueIds(
      variant.combinations,
      attributeValueMap,
    );

    if (existingSkuSet.has(variant.sku)) {
      await tx.productVariant.update({
        where: { sku: variant.sku },
        data: {
          product_id: productId,
          selling_price: variant.selling_price,
          cogs: variant.cogs,
          image_url: variant.image_url,
          status: "active",
          attribute_values: {
            deleteMany: {},
            ...(createVariantAttributeValues(attributeValueIds) ?? {}),
          },
        },
      });
      await ensureInventoryStockExists(tx, variant.sku);
      continue;
    }

    await tx.productVariant.create({
      data: {
        sku: variant.sku,
        product_id: productId,
        selling_price: variant.selling_price,
        cogs: variant.cogs,
        image_url: variant.image_url,
        status: "active",
        attribute_values: createVariantAttributeValues(attributeValueIds),
      },
    });
    await ensureInventoryStockExists(tx, variant.sku);
  }
};

const resolveCategoryId = async (
  tx: PrismaTransaction,
  payload: ProductRequestInput,
) => {
  if (payload.category_id !== undefined) {
    if (payload.category_id === null) {
      return null;
    }

    const category = await tx.category.findUnique({
      where: { id: payload.category_id },
      select: { id: true },
    });

    if (!category) {
      throw new BadRequestError("category_id is invalid");
    }

    return category.id;
  }

  const categoryName = toOptionalTrimmedString(payload.category);

  if (!categoryName) {
    return null;
  }

  const category = await tx.category.findFirst({
    where: { category_name: categoryName },
    select: { id: true },
  });

  if (!category) {
    throw new BadRequestError(`Category "${categoryName}" does not exist`);
  }

  return category.id;
};

const normalizeProductInput = async (
  tx: PrismaTransaction,
  payload: ProductRequestInput,
) => {
  const productName = toOptionalTrimmedString(payload.product_name);

  if (!productName) {
    throw new BadRequestError("product_name is required");
  }

  const sku = toOptionalTrimmedString(payload.sku);
  const attributes = normalizeAttributeInputs(payload.attributes);
  const categoryId = await resolveCategoryId(tx, payload);

  const variants =
    attributes.length === 0
      ? (() => {
          const sellingPrice =
            toOptionalNumber(payload.base_price) ??
            toOptionalNumber(payload.variants?.[0]?.selling_price) ??
            toOptionalNumber(payload.variants?.[0]?.price) ??
            0;

          if (!sku) {
            throw new BadRequestError("sku is required for products without variants");
          }

          const singleVariantImage =
            toNullableTrimmedString(payload.variants?.[0]?.image_url) ??
            toOptionalTrimmedStringOrNull(payload.image_url);

          return [
            {
              sku,
              selling_price: sellingPrice,
              cogs:
                toOptionalNumber(payload.variants?.[0]?.cogs) ??
                toOptionalNumber(payload.cogs) ??
                sellingPrice,
              image_url: singleVariantImage,
              combinations: [],
            },
          ];
        })()
      : (payload.variants ?? []).map((variant) => {
          const variantSku = toOptionalTrimmedString(variant.sku);
          const sellingPrice =
            toOptionalNumber(variant.selling_price) ?? toOptionalNumber(variant.price) ?? 0;

          if (!variantSku) {
            throw new BadRequestError("Each variant must have a sku");
          }

          const combinations = normalizeVariantCombinations(variant);

          if (combinations.length === 0) {
            throw new BadRequestError(
              `Variant "${variantSku}" must have at least one combination value`,
            );
          }

          return {
            sku: variantSku,
            selling_price: sellingPrice,
            cogs:
              toOptionalNumber(variant.cogs) ??
              toOptionalNumber(payload.cogs) ??
              sellingPrice,
            image_url: toOptionalTrimmedStringOrNull(variant.image_url),
            combinations,
          };
        });

  if (attributes.length > 0 && variants.length === 0) {
    throw new BadRequestError("variants are required when the product has attributes");
  }

  ensureUniqueValues(
    variants.map((variant) => variant.sku),
    "variants.sku",
  );

  return {
    product_name: productName,
    sku,
    unit: toOptionalTrimmedString(payload.unit),
    base_price: attributes.length === 0 ? variants[0]?.selling_price ?? null : null,
    cogs:
      attributes.length === 0
        ? variants[0]?.cogs ?? toOptionalNumber(payload.cogs) ?? null
        : toOptionalNumber(payload.cogs) ?? null,
    image_url: toOptionalTrimmedStringOrNull(payload.image_url),
    status: normalizeProductStatus(payload.status),
    description: toNullableTrimmedString(payload.description),
    created_at: payload.created_at,
    category_id: categoryId,
    attributes,
    variants,
  } satisfies ProductInput;
};

const getProductOrThrow = async (id: number) => {
  const product = await prisma.product.findUnique({
    where: { id },
    include: productInclude,
  });

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  return product;
};

export const ProductService = {
  getCategories: async () => {
    if (categoryCache && categoryCache.expiresAt > Date.now()) {
      return categoryCache.data;
    }

    const categories = await prisma.category.findMany({
      select: {
        id: true,
        category_name: true,
      },
      orderBy: {
        category_name: "asc",
      },
    });

    categoryCache = {
      data: categories,
      expiresAt: Date.now() + CATEGORY_CACHE_TTL_MS,
    };

    return categories;
  },

  getCategoryById: async (id: number) => {
    const category = await prisma.category.findUnique({
      where: { id },
      select: {
        id: true,
        category_name: true,
      },
    });

    if (!category) {
      throw new NotFoundError("Category not found");
    }

    return category;
  },

  createCategory: async (payload: ProductCategoryRequestInput) => {
    const categoryName = normalizeCategoryName(payload.category_name);

    return prisma.$transaction(async (tx) => {
      await ensureCategoryNameIsUnique(tx, categoryName);

      const category = await tx.category.create({
        data: {
          category_name: categoryName,
        },
        select: {
          id: true,
          category_name: true,
        },
      });

      clearCategoryCache();
      return category;
    });
  },

  createProduct: async (payload: ProductRequestInput) => {
    const { product, oldImageUrlToDelete } = await prisma.$transaction(async (tx) => {
      const data = await normalizeProductInput(tx, payload);

      // Restore soft-deleted product when the root SKU matches.
      let existingProduct = null;
      if (data.sku) {
        existingProduct = await tx.product.findFirst({
          where: {
            sku: data.sku,
            status: "deleted",
          },
          include: productInclude,
        });
      }

      if (existingProduct) {
        const oldImageUrlToDelete =
          existingProduct.image_url &&
          data.image_url !== undefined &&
          existingProduct.image_url !== data.image_url
            ? existingProduct.image_url
            : null;
        const existingVariantSkus = await getProductVariantSkus(tx, existingProduct.id);

        await tx.product.update({
          where: { id: existingProduct.id },
          data: {
            ...toProductData(data),
            status: "active",
          },
        });

        await deleteVariantAttributeLinks(tx, existingVariantSkus);
        await tx.attributeValue.deleteMany({
          where: { attribute: { product_id: existingProduct.id } },
        });
        await tx.attribute.deleteMany({
          where: { product_id: existingProduct.id },
        });

        // Add new attributes
        for (const attr of data.attributes) {
          await tx.attribute.create({
            data: {
              name: attr.name,
              product_id: existingProduct.id,
              values: {
                create: attr.values.map((value) => ({ value })),
              },
            },
          });
        }


        // Re-fetch attributes to get IDs
        const updatedAttributes = await tx.attribute.findMany({
          where: { product_id: existingProduct.id },
          include: { values: true },
        });

        const updatedAttributeValueMap = buildAttributeValueMap(updatedAttributes);

        await syncVariants(tx, existingProduct.id, data.variants, updatedAttributeValueMap);

        const product = await tx.product.findUniqueOrThrow({
          where: { id: existingProduct.id },
          include: productInclude,
        });

        return {
          product,
          oldImageUrlToDelete,
        };
      }

      await ensureNoCrossProductSkuConflict(
        tx,
        -1,
        data.variants.map((variant) => variant.sku),
      );

      const createdProduct = await tx.product.create({
        data: {
          ...toProductData(data),
          attributes: toAttributeCreateData(data.attributes),
        },
        include: { attributes: { include: { values: true } } },
      });

      const attributeValueMap = buildAttributeValueMap(createdProduct.attributes);

      await syncVariants(tx, createdProduct.id, data.variants, attributeValueMap);

      const product = await tx.product.findUniqueOrThrow({
        where: { id: createdProduct.id },
        include: productInclude,
      });
      return {
        product,
        oldImageUrlToDelete: null,
      };
    });

    await deleteManagedProductImageFromS3(oldImageUrlToDelete);
    return product;
  },

  getProducts: async () => {
    return prisma.product.findMany({
      where: {
        status: {
          not: "deleted",
        },
      },
      include: productInclude,
    });
  },

  getProductById: async (id: number) => getProductOrThrow(id),

  editCategory: async (id: number, payload: ProductCategoryRequestInput) => {
    const categoryName = normalizeCategoryName(payload.category_name);

    return prisma.$transaction(async (tx) => {
      const existingCategory = await tx.category.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!existingCategory) {
        throw new NotFoundError("Category not found");
      }

      await ensureCategoryNameIsUnique(tx, categoryName, id);

      const category = await tx.category.update({
        where: { id },
        data: {
          category_name: categoryName,
        },
        select: {
          id: true,
          category_name: true,
        },
      });

      clearCategoryCache();
      return category;
    });
  },

  deleteCategories: async (ids: number[]) => {
    const uniqueIds = getUniqueIds(ids);

    return prisma.$transaction(async (tx) => {
      const existingCategories = await tx.category.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true, category_name: true },
      });

      if (existingCategories.length !== uniqueIds.length) {
        throw new NotFoundError("One or more categories were not found");
      }

      const linkedProducts = await tx.product.findMany({
        where: { category_id: { in: uniqueIds } },
        select: { product_name: true, category_id: true },
        take: 5,
      });

      if (linkedProducts.length > 0) {
        const categoryNameById = new Map(
          existingCategories.map((category) => [category.id, category.category_name]),
        );
        const affectedCategoryNames = [
          ...new Set(
            linkedProducts
              .map((product) => categoryNameById.get(product.category_id ?? -1))
              .filter(Boolean),
          ),
        ];

        throw new ConflictError(
          `Cannot delete categories that are still assigned to products: ${affectedCategoryNames.join(", ")}`,
        );
      }

      await tx.category.deleteMany({
        where: { id: { in: uniqueIds } },
      });

      clearCategoryCache();
    });
  },

  editProduct: async (id: number, payload: ProductRequestInput) => {
    const { product, oldImageUrlToDelete } = await prisma.$transaction(async (tx) => {
      const existingProduct = await tx.product.findUnique({
        where: { id },
        include: {
          variants: {
            select: { sku: true },
          },
        },
      });

      if (!existingProduct) {
        throw new NotFoundError("Product not found");
      }

      const data = await normalizeProductInput(tx, payload);
      const oldImageUrlToDelete =
        existingProduct.image_url &&
        data.image_url !== undefined &&
        existingProduct.image_url !== data.image_url
          ? existingProduct.image_url
          : null;
      const existingSkus = existingProduct.variants.map((variant) => variant.sku);

      await ensureNoCrossProductSkuConflict(
        tx,
        id,
        data.variants.map((variant) => variant.sku),
      );

      await deleteVariantAttributeLinks(tx, existingSkus);

      await tx.attributeValue.deleteMany({
        where: {
          attribute: { product_id: id },
        },
      });

      await tx.attribute.deleteMany({
        where: { product_id: id },
      });

      const updatedProduct = await tx.product.update({
        where: { id },
        data: {
          ...toProductData(data),
          attributes: toAttributeCreateData(data.attributes),
        },
        include: { attributes: { include: { values: true } } },
      });

      const attributeValueMap = buildAttributeValueMap(updatedProduct.attributes);

      await syncVariants(tx, id, data.variants, attributeValueMap);

      const product = await tx.product.findUniqueOrThrow({
        where: { id },
        include: productInclude,
      });
      return {
        product,
        oldImageUrlToDelete,
      };
    });

    await deleteManagedProductImageFromS3(oldImageUrlToDelete);
    return product;
  },

  deleteProducts: async (ids: number[]) => {
    const uniqueIds = getUniqueIds(ids);

    return prisma.$transaction(async (tx) => {
      const existingProducts = await tx.product.findMany({
        where: { id: { in: uniqueIds } },
        select: {
          id: true,
          status: true,
        },
      });

      if (existingProducts.length !== uniqueIds.length) {
        throw new NotFoundError("One or more products were not found");
      }

      const productIdsToDelete = existingProducts.map((product) => product.id);
      const variantSkusToDelete = await tx.productVariant.findMany({
        where: { product_id: { in: productIdsToDelete } },
        select: { sku: true },
      });
      const variantSkuList = variantSkusToDelete.map((variant) => variant.sku);

      await resetInventoryStocks(tx, variantSkuList);
      await tx.productVariant.updateMany({
        where: { product_id: { in: productIdsToDelete } },
        data: { status: "deleted" },
      });

      await tx.product.updateMany({
        where: { id: { in: productIdsToDelete } },
        data: { status: "deleted" },
      });

      return {
        deleted_ids: productIdsToDelete,
      };
    });
  },
};
