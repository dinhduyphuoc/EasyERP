import { Prisma } from "../../../generated/prisma/client";
import { cache } from "@lib/cache";
import { deleteManagedProductImageFromS3 } from "@lib/s3";
import { BadRequestError, ConflictError, NotFoundError } from "@/common";
import {
  ProductRepository,
  type ProductDetailRecord,
  type ProductListRecord,
  type ProductTransaction,
} from "./product.repository";
import type {
  ProductCategoryItem,
  ProductImportRequestInput,
  ProductImportResultItem,
  ProductListResponseItem,
  ProductCategoryRequestInput,
  ProductInput,
  ProductListQuery,
  ProductRequestInput,
  ProductStatusInput,
} from "./product.types";

const CATEGORY_CACHE_TTL_SECONDS = 5 * 60;
const PRODUCT_LIST_CACHE_TTL_SECONDS = 60;
const PRODUCT_DETAIL_CACHE_TTL_SECONDS = 60;
const PRISMA_INTERACTIVE_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 20_000,
} as const;

const productCacheKeys = {
  categories: (storeId: string) => `products:${storeId}:categories`,
  detail: (storeId: string, productId: number) => `products:${storeId}:detail:${productId}`,
  listPrefix: (storeId: string) => `products:${storeId}:list:`,
  list: (storeId: string, query: ProductListQuery) =>
    `products:${storeId}:list:${JSON.stringify(normalizeProductListQuery(query))}`,
};

const invalidateCategoryReadModels = async (storeId: string) => {
  await cache.delete(productCacheKeys.categories(storeId));
  await cache.deleteByPrefix(productCacheKeys.listPrefix(storeId));
};

const invalidateProductReadModels = async (storeId: string, productIds: number[] = []) => {
  await cache.deleteByPrefix(productCacheKeys.listPrefix(storeId));

  await Promise.all(
    productIds.map((productId) => cache.delete(productCacheKeys.detail(storeId, productId))),
  );
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
  tx: ProductTransaction,
  storeId: string,
  categoryName: string,
  ignoreCategoryId?: number,
) => {
  const existingCategory = await ProductRepository.findCategoryNameConflict(
    tx,
    storeId,
    categoryName,
    ignoreCategoryId,
  );

  if (existingCategory) {
    throw new ConflictError(`Category "${categoryName}" already exists`);
  }
};

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

const normalizePersistedImageUrl = (value: unknown) => {
  const imageUrl = toOptionalTrimmedStringOrNull(value);

  if (typeof imageUrl === "string" && imageUrl.startsWith("blob:")) {
    throw new BadRequestError("image_url must be an uploaded URL, not a local blob preview");
  }

  return imageUrl;
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

const decimalToString = (value: { toString(): string } | null | undefined) =>
  value ? value.toString() : null;

const mapProductListItem = (product: ProductListRecord): ProductListResponseItem => {
  const numericPrices = product.variants
    .map((variant) => Number(variant.selling_price.toString()))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  const primaryVariant =
    product.variants.find((variant) => variant.sku === product.spu) ??
    product.variants[0] ??
    null;

  return {
    id: product.id,
    spu_id: product.id,
    spu_code: null,
    spu: product.spu,
    product_name: product.product_name,
    image_url: product.image_url,
    status: product.status,
    category_id: product.category_id,
    min_price:
      numericPrices.length > 0 ? String(numericPrices[0]) : null,
    max_price:
      numericPrices.length > 0 ? String(numericPrices[numericPrices.length - 1]) : null,
    variant_count: product.variants.length,
    has_generated_variants: product.variants.some((variant) => variant.kind === "generated"),
    primary_variant: primaryVariant
      ? {
          sku_code: primaryVariant.sku,
          sku: primaryVariant.sku,
          kind: primaryVariant.kind,
          selling_price: primaryVariant.selling_price.toString(),
          image_url: primaryVariant.image_url,
        }
      : null,
  };
};

const mapProductDetailItem = (product: ProductDetailRecord) => ({
  ...product,
  spu_id: product.id,
  spu_code: null,
  spu: product.spu,
  variants: product.variants.map((variant) => ({
    ...variant,
    sku_code: variant.sku,
    spu_id: product.id,
    attribute_value_ids: variant.attribute_values.map((item) => item.attribute_value_id),
  })),
});

const PRODUCT_STATUSES: ProductStatusInput[] = ["active", "inactive", "draft", "deleted"];

const normalizeProductListQuery = (query: ProductListQuery = {}): ProductListQuery => ({
  search: toOptionalTrimmedString(query.search),
  status: query.status,
  category_id: query.category_id,
  include_deleted: query.include_deleted === true,
  page: query.page,
  page_size: query.page_size,
});

const buildProductListWhere = (
  storeId: string,
  query: ProductListQuery,
): Prisma.ProductWhereInput => {
  const normalizedQuery = normalizeProductListQuery(query);
  const search = normalizedQuery.search;
  const variantSearchWhere =
    normalizedQuery.include_deleted || normalizedQuery.status === "deleted"
      ? {
          sku: { contains: search, mode: "insensitive" as const },
        }
      : {
          sku: { contains: search, mode: "insensitive" as const },
          status: "active" as const,
        };

  return {
    store_id: storeId,
    ...(normalizedQuery.status
      ? { status: normalizedQuery.status }
      : normalizedQuery.include_deleted
        ? {}
        : { status: { not: "deleted" } }),
    ...(normalizedQuery.category_id ? { category_id: normalizedQuery.category_id } : {}),
    ...(search
      ? {
          OR: [
            { product_name: { contains: search, mode: "insensitive" } },
            { spu: { contains: search, mode: "insensitive" } },
            {
              variants: {
                some: variantSearchWhere,
              },
            },
          ],
        }
      : {}),
  };
};

const getProductListPagination = (query: ProductListQuery) => {
  if (!query.page || !query.page_size) {
    return {};
  }

  const pageSize = Math.min(query.page_size, 100);

  return {
    skip: (query.page - 1) * pageSize,
    take: pageSize,
  };
};

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
  const directAttributeValueIds = (variant.attribute_value_ids ?? []).filter(
    (value): value is number => typeof value === "number" && Number.isInteger(value) && value > 0,
  );

  if (directAttributeValueIds.length > 0) {
    return {
      attributeValueIds: directAttributeValueIds,
      combinations: [] as string[],
    };
  }

  const directCombinations = (variant.combinations ?? [])
    .map((combination) => combination.trim())
    .filter(Boolean);

  if (directCombinations.length > 0) {
    return {
      attributeValueIds: [] as number[],
      combinations: directCombinations,
    };
  }

  const derivedCombinations = (variant.name ?? "")
    .split("/")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    attributeValueIds: [] as number[],
    combinations: derivedCombinations,
  };
};

const ensureUniqueValues = (values: string[], fieldName: string) => {
  const unique = new Set(values);

  if (unique.size !== values.length) {
    throw new BadRequestError(`${fieldName} đã tồn tại`);
  }
};

const toProductData = (data: ProductInput) => ({
  product_name: data.product_name,
  spu: data.spu,
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
  variant: {
    combinations: string[];
    attribute_value_ids?: number[];
  },
  attributeValueMap: Map<string, number>,
) => {
  if (variant.attribute_value_ids && variant.attribute_value_ids.length > 0) {
    return variant.attribute_value_ids;
  }

  return variant.combinations.map((combination) => {
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
  tx: ProductTransaction,
  storeId: string,
  productId: number,
  variantSkus: string[],
) => {
  if (!variantSkus.length) {
    return;
  }

  const conflictingVariant = await ProductRepository.findVariantSkuConflict(
    tx,
    storeId,
    productId,
    variantSkus,
  );

  if (conflictingVariant) {
    throw new ConflictError(`Phiên bản "${conflictingVariant.sku}" đã được tạo`);
  }
};

const ensureInventoryStockExists = async (
  tx: ProductTransaction,
  productVariantId: string,
) => {
  const variant = await ProductRepository.findVariantStoreBySku(tx, productVariantId);

  if (!variant) {
    throw new NotFoundError(`Không tìm thấy phiên bản sản phẩm "${productVariantId}"`);
  }

  await ProductRepository.upsertInventoryStock(tx, productVariantId, variant.store_id);
};

const resetInventoryStocks = async (
  tx: ProductTransaction,
  variantSkus: string[],
) => {
  if (variantSkus.length === 0) {
    return;
  }

  await ProductRepository.resetInventoryStocks(tx, variantSkus);
};

const getProductVariantSkus = async (tx: ProductTransaction, productId: number) => {
  const variants = await ProductRepository.findProductVariantSkus(tx, productId);

  return variants.map((variant) => variant.sku);
};

const deleteVariantAttributeLinks = async (
  tx: ProductTransaction,
  variantSkus: string[],
) => {
  if (variantSkus.length === 0) {
    return;
  }

  await ProductRepository.deleteVariantAttributeLinks(tx, variantSkus);
};

const syncVariants = async (
  tx: ProductTransaction,
  storeId: string,
  productId: number,
  variants: ProductInput["variants"],
  attributeValueMap: Map<string, number>,
) => {
  const existingVariants = await ProductRepository.findExistingVariants(tx, productId);
  const existingSkuSet = new Set(existingVariants.map((variant) => variant.sku));
  const nextSkuSet = new Set(variants.map((variant) => variant.sku));
  const hasGeneratedVariants = variants.some((variant) => variant.combinations.length > 0);
  const disabledDefaultVariantSkus =
    hasGeneratedVariants
      ? existingVariants
          .filter(
            (variant) => variant.kind === "default" && !nextSkuSet.has(variant.sku),
          )
          .map((variant) => variant.sku)
      : [];
  const removedSkus = existingVariants
    .map((variant) => variant.sku)
    .filter(
      (sku) => !nextSkuSet.has(sku) && !disabledDefaultVariantSkus.includes(sku),
    );

  if (disabledDefaultVariantSkus.length > 0) {
    await ProductRepository.deactivateVariants(tx, disabledDefaultVariantSkus);
  }

  if (removedSkus.length > 0) {
    await resetInventoryStocks(tx, removedSkus);
    await ProductRepository.markVariantsDeleted(tx, removedSkus);
  }

  for (const variant of variants) {
    const attributeValueIds = resolveAttributeValueIds(variant, attributeValueMap);

    if (existingSkuSet.has(variant.sku)) {
      await ProductRepository.updateVariant(tx, variant.sku, {
        store_id: storeId,
        product_id: productId,
        selling_price: variant.selling_price,
        cogs: variant.cogs,
        image_url: variant.image_url,
        kind: variant.kind,
        status: "active",
        attribute_values: {
          deleteMany: {},
          ...(createVariantAttributeValues(attributeValueIds) ?? {}),
        },
      });
      await ensureInventoryStockExists(tx, variant.sku);
      continue;
    }

    await ProductRepository.createVariant(tx, {
      sku: variant.sku,
      store_id: storeId,
      product_id: productId,
      selling_price: variant.selling_price,
      cogs: variant.cogs,
      image_url: variant.image_url,
      kind: variant.kind,
      status: "active",
      attribute_values: createVariantAttributeValues(attributeValueIds),
    });
    await ensureInventoryStockExists(tx, variant.sku);
  }
};

const resolveCategoryId = async (
  tx: ProductTransaction,
  storeId: string,
  payload: ProductRequestInput,
) => {
  if (payload.category_id !== undefined) {
    if (payload.category_id === null) {
      return null;
    }

    const category = await ProductRepository.findCategoryByStoreAndId(
      tx,
      storeId,
      payload.category_id,
    );

    if (!category) {
      throw new BadRequestError("category_id is invalid");
    }

    return category.id;
  }

  const categoryName = toOptionalTrimmedString(payload.category);

  if (!categoryName) {
    return null;
  }

  const category = await ProductRepository.findCategoryIdByStoreAndName(tx, storeId, categoryName);

  if (!category) {
    throw new BadRequestError(`Category "${categoryName}" does not exist`);
  }

  return category.id;
};

const normalizeProductInput = async (
  tx: ProductTransaction,
  storeId: string,
  payload: ProductRequestInput,
) => {
  const productName = toOptionalTrimmedString(payload.product_name);

  if (!productName) {
    throw new BadRequestError("product_name is required");
  }

  const legacyPayload = payload as ProductRequestInput & {
    default_sku_code?: unknown;
  };
  const defaultSpu =
    toOptionalTrimmedString(payload.spu) ??
    toOptionalTrimmedString(legacyPayload.default_sku_code) ??
    toOptionalTrimmedString(payload.default_variant_sku);
  const attributes = normalizeAttributeInputs(payload.attributes);
  const categoryId = await resolveCategoryId(tx, storeId, payload);

  const variants =
    attributes.length === 0
      ? (() => {
          const sellingPrice =
            toOptionalNumber(payload.base_price) ??
            toOptionalNumber(payload.variants?.[0]?.selling_price) ??
            toOptionalNumber(payload.variants?.[0]?.price) ??
            0;

          if (!defaultSpu) {
            throw new BadRequestError("spu is required for products without variants");
          }

          const singleVariantImage =
            normalizePersistedImageUrl(payload.variants?.[0]?.image_url) ??
            normalizePersistedImageUrl(payload.image_url);

          return [
            {
              sku: defaultSpu,
              kind: "default" as const,
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
          const variantSku =
            toOptionalTrimmedString(variant.sku_code) ??
            toOptionalTrimmedString(variant.sku);
          const sellingPrice =
            toOptionalNumber(variant.selling_price) ?? toOptionalNumber(variant.price) ?? 0;

          if (!variantSku) {
            throw new BadRequestError("Each variant must have a sku");
          }

          const normalizedVariantLinks = normalizeVariantCombinations(variant);

          if (
            normalizedVariantLinks.combinations.length === 0 &&
            normalizedVariantLinks.attributeValueIds.length === 0
          ) {
            throw new BadRequestError(
              `Variant "${variantSku}" must have at least one combination value`,
            );
          }

          return {
            sku: variantSku,
            kind: "generated" as const,
            selling_price: sellingPrice,
            cogs:
              toOptionalNumber(variant.cogs) ??
              toOptionalNumber(payload.cogs) ??
              sellingPrice,
            image_url: normalizePersistedImageUrl(variant.image_url),
            combinations: normalizedVariantLinks.combinations,
            attribute_value_ids: normalizedVariantLinks.attributeValueIds,
          };
        });

  if (attributes.length > 0 && variants.length === 0) {
    throw new BadRequestError("variants are required when the product has attributes");
  }

  ensureUniqueValues(
    variants.map((variant) => variant.sku),
    "variants.sku",
  );

  const resolvedDefaultSku =
    attributes.length === 0
      ? variants[0]?.sku ?? defaultSpu ?? null
      : defaultSpu ?? variants[0]?.sku ?? null;

  return {
    spu_id: payload.spu_id,
    spu_code: toOptionalTrimmedString(payload.spu_code) ?? null,
    spu: resolvedDefaultSku,
    product_name: productName,
    unit: toOptionalTrimmedString(payload.unit),
    base_price: attributes.length === 0 ? variants[0]?.selling_price ?? null : null,
    cogs:
      attributes.length === 0
        ? variants[0]?.cogs ?? toOptionalNumber(payload.cogs) ?? null
        : null,
    image_url: normalizePersistedImageUrl(payload.image_url),
    status: normalizeProductStatus(payload.status),
    description: toNullableTrimmedString(payload.description),
    created_at: payload.created_at,
    category_id: categoryId,
    attributes,
    variants,
  } satisfies ProductInput;
};

const getProductOrThrow = async (storeId: string, id: number) => {
  const product = await ProductRepository.findProductDetailOrThrow(storeId, id);

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  return product;
};

const getCachedCategories = async (storeId: string) => {
  const cacheKey = productCacheKeys.categories(storeId);
  const cached = await cache.getJson<ProductCategoryItem[]>(cacheKey);

  if (cached) {
    return cached;
  }

  const categories = await ProductRepository.findCategories(storeId);

  await cache.setJson(cacheKey, categories, CATEGORY_CACHE_TTL_SECONDS);
  return categories;
};

const getCachedProductList = async (storeId: string, query: ProductListQuery = {}) => {
  const normalizedQuery = normalizeProductListQuery(query);
  const cacheKey = productCacheKeys.list(storeId, normalizedQuery);
  const cached = await cache.getJson<ProductListResponseItem[]>(cacheKey);

  if (cached) {
    return cached;
  }

  const pagination = getProductListPagination(normalizedQuery);
  const products: ProductListRecord[] = await ProductRepository.findProductsForList({
    storeId,
    where: buildProductListWhere(storeId, normalizedQuery),
    ...("skip" in pagination ? { skip: pagination.skip, take: pagination.take } : {}),
  });
  const items = products.map((product) => mapProductListItem(product));

  await cache.setJson(cacheKey, items, PRODUCT_LIST_CACHE_TTL_SECONDS);
  return items;
};

const getCachedProductDetail = async (storeId: string, productId: number) => {
  const cacheKey = productCacheKeys.detail(storeId, productId);
  const cached = await cache.getJson<ReturnType<typeof mapProductDetailItem>>(cacheKey);

  if (cached) {
    return cached;
  }

  const product = await getProductOrThrow(storeId, productId);
  const mappedProduct = mapProductDetailItem(product);
  await cache.setJson(cacheKey, mappedProduct, PRODUCT_DETAIL_CACHE_TTL_SECONDS);
  return mappedProduct;
};

export const ProductService = {
  getCategories: async (storeId: string) => {
    return getCachedCategories(storeId);
  },

  getCategoryById: async (storeId: string, id: number) => {
    const category = await ProductRepository.findCategoryById(storeId, id);

    if (!category) {
      throw new NotFoundError("Category not found");
    }

    return category;
  },

  createCategory: async (storeId: string, payload: ProductCategoryRequestInput) => {
    const categoryName = normalizeCategoryName(payload.category_name);

    const category = await ProductRepository.withTransaction(async (tx) => {
      await ensureCategoryNameIsUnique(tx, storeId, categoryName);

      return ProductRepository.createCategory(tx, storeId, categoryName);
    }, PRISMA_INTERACTIVE_TRANSACTION_OPTIONS);

    await invalidateCategoryReadModels(storeId);
    return category;
  },

  createProduct: async (storeId: string, payload: ProductRequestInput) => {
    const { product, oldImageUrlToDelete } = await ProductRepository.withTransaction(async (tx) => {
      const data = await normalizeProductInput(tx, storeId, payload);

      // Restore soft-deleted product when the default simple-variant SKU matches.
      let existingProduct = null;
      if (data.spu) {
        existingProduct = await ProductRepository.findSoftDeletedProductBySpu(
          tx,
          storeId,
          data.spu,
        );
      }

      if (existingProduct) {
        const oldImageUrlToDelete =
          existingProduct.image_url &&
          data.image_url !== undefined &&
          existingProduct.image_url !== data.image_url
            ? existingProduct.image_url
            : null;
        const existingVariantSkus = await getProductVariantSkus(tx, existingProduct.id);

        await ProductRepository.updateProductRecord(tx, existingProduct.id, {
          ...toProductData(data),
          status: "active",
          store_id: storeId,
        });

        await deleteVariantAttributeLinks(tx, existingVariantSkus);
        await ProductRepository.deleteAttributeValueLinksByProductId(tx, existingProduct.id);
        await ProductRepository.deleteAttributesByProductId(tx, existingProduct.id);

        // Add new attributes
        for (const attr of data.attributes) {
          await ProductRepository.createAttribute(tx, existingProduct.id, attr);
        }


        // Re-fetch attributes to get IDs
        const updatedAttributes = await ProductRepository.findAttributesWithValuesByProductId(
          tx,
          existingProduct.id,
        );

        const updatedAttributeValueMap = buildAttributeValueMap(updatedAttributes);

        await syncVariants(tx, storeId, existingProduct.id, data.variants, updatedAttributeValueMap);

        const product = await ProductRepository.findProductDetailByIdOrThrowInTx(
          tx,
          existingProduct.id,
        );

        return {
          product,
          oldImageUrlToDelete,
        };
      }

      await ensureNoCrossProductSkuConflict(
        tx,
        storeId,
        -1,
        data.variants.map((variant) => variant.sku),
      );

      const createdProduct = await ProductRepository.createProductWithAttributes(tx, {
        ...toProductData(data),
        store_id: storeId,
        attributes: toAttributeCreateData(data.attributes),
      });

      const attributeValueMap = buildAttributeValueMap(createdProduct.attributes);

      await syncVariants(tx, storeId, createdProduct.id, data.variants, attributeValueMap);

      const product = await ProductRepository.findProductDetailByIdOrThrowInTx(tx, createdProduct.id);
      return {
        product,
        oldImageUrlToDelete: null,
      };
    }, PRISMA_INTERACTIVE_TRANSACTION_OPTIONS);

    await deleteManagedProductImageFromS3(oldImageUrlToDelete);
    await invalidateProductReadModels(storeId, [product.id]);
    return mapProductDetailItem(product);
  },

  getProducts: async (storeId: string, query: ProductListQuery = {}) => {
    return getCachedProductList(storeId, query);
  },

  getProductById: async (storeId: string, id: number) => getCachedProductDetail(storeId, id),

  editCategory: async (storeId: string, id: number, payload: ProductCategoryRequestInput) => {
    const categoryName = normalizeCategoryName(payload.category_name);

    const category = await ProductRepository.withTransaction(async (tx) => {
      const existingCategory = await ProductRepository.findCategoryByStoreAndId(tx, storeId, id);

      if (!existingCategory) {
        throw new NotFoundError("Category not found");
      }

      await ensureCategoryNameIsUnique(tx, storeId, categoryName, id);

      return ProductRepository.updateCategory(tx, id, categoryName);
    }, PRISMA_INTERACTIVE_TRANSACTION_OPTIONS);

    await invalidateCategoryReadModels(storeId);
    return category;
  },

  deleteCategories: async (storeId: string, ids: number[]) => {
    const uniqueIds = getUniqueIds(ids);

    await ProductRepository.withTransaction(async (tx) => {
      const existingCategories = await ProductRepository.findCategoriesByIds(tx, storeId, uniqueIds);

      if (existingCategories.length !== uniqueIds.length) {
        throw new NotFoundError("One or more categories were not found");
      }

      const linkedProducts = await ProductRepository.findLinkedProductsByCategoryIds(
        tx,
        storeId,
        uniqueIds,
      );

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

      await ProductRepository.deleteCategories(tx, storeId, uniqueIds);
    }, PRISMA_INTERACTIVE_TRANSACTION_OPTIONS);

    await invalidateCategoryReadModels(storeId);
  },

  editProduct: async (storeId: string, id: number, payload: ProductRequestInput) => {
    const { product, oldImageUrlToDelete } = await ProductRepository.withTransaction(async (tx) => {
      const existingProduct = await ProductRepository.findProductForEdit(tx, storeId, id);

      if (!existingProduct) {
        throw new NotFoundError("Product not found");
      }

      const data = await normalizeProductInput(tx, storeId, payload);
      const oldImageUrlToDelete =
        existingProduct.image_url &&
        data.image_url !== undefined &&
        existingProduct.image_url !== data.image_url
          ? existingProduct.image_url
          : null;
      const existingSkus = existingProduct.variants.map((variant) => variant.sku);

      await ensureNoCrossProductSkuConflict(
        tx,
        storeId,
        id,
        data.variants.map((variant) => variant.sku),
      );

      await deleteVariantAttributeLinks(tx, existingSkus);

      await ProductRepository.deleteAttributeValueLinksByProductId(tx, id);
      await ProductRepository.deleteAttributesByProductId(tx, id);

      const updatedProduct = await ProductRepository.updateProductWithAttributes(tx, id, {
        ...toProductData(data),
        attributes: toAttributeCreateData(data.attributes),
      });

      const attributeValueMap = buildAttributeValueMap(updatedProduct.attributes);

      await syncVariants(tx, storeId, id, data.variants, attributeValueMap);

      const product = await ProductRepository.findProductDetailByIdOrThrowInTx(tx, id);
      return {
        product,
        oldImageUrlToDelete,
      };
    }, PRISMA_INTERACTIVE_TRANSACTION_OPTIONS);

    await deleteManagedProductImageFromS3(oldImageUrlToDelete);
    await invalidateProductReadModels(storeId, [id]);
    return mapProductDetailItem(product);
  },

  importProducts: async (
    storeId: string,
    payload: ProductImportRequestInput,
  ): Promise<ProductImportResultItem[]> => {
    if (!Array.isArray(payload.rows) || payload.rows.length === 0) {
      throw new BadRequestError("rows must be a non-empty array");
    }

    const results: ProductImportResultItem[] = [];

    for (const [index, row] of payload.rows.entries()) {
      const rowNo = row.row_no ?? index + 1;
      const importMode = row.import_mode ?? "upsert";
      const legacyRow = row as ProductRequestInput & { default_sku_code?: unknown };
      const defaultSkuCode =
        toOptionalTrimmedString(legacyRow.default_sku_code) ??
        toOptionalTrimmedString(row.default_variant_sku) ??
        null;
      const firstVariantSku =
        row.variants?.find((variant) => toOptionalTrimmedString(variant.sku_code) ?? toOptionalTrimmedString(variant.sku))
          ?.sku_code ??
        row.variants?.find((variant) => toOptionalTrimmedString(variant.sku_code) ?? toOptionalTrimmedString(variant.sku))
          ?.sku ??
        null;

      let targetProductId =
        row.spu_id !== undefined && row.spu_id !== null ? Number(row.spu_id) : undefined;

      if (!targetProductId && defaultSkuCode) {
        const existingByDefaultSku = await ProductRepository.findActiveProductBySpu(storeId, defaultSkuCode);
        targetProductId = existingByDefaultSku?.id;
      }

      if (!targetProductId && firstVariantSku) {
        const existingByVariantSku = await ProductRepository.findProductIdByVariantSku(storeId, firstVariantSku);
        targetProductId = existingByVariantSku?.product_id;
      }

      if (importMode === "create_only" && targetProductId) {
        throw new ConflictError(`rows[${index}] matched an existing SPU and cannot be created twice`);
      }

      if (importMode === "update_only" && !targetProductId) {
        throw new NotFoundError(`rows[${index}] did not match an existing SPU to update`);
      }

      const product = targetProductId
        ? await ProductService.editProduct(storeId, targetProductId, row)
        : await ProductService.createProduct(storeId, row);

      results.push({
        row_no: rowNo,
        action: targetProductId ? "updated" : "created",
        spu_id: product.id,
        spu: product.spu ?? null,
        product_name: product.product_name,
      });
    }

    return results;
  },

  deleteProducts: async (storeId: string, ids: number[]) => {
    const uniqueIds = getUniqueIds(ids);

    const result = await ProductRepository.withTransaction(async (tx) => {
      const existingProducts = await ProductRepository.findProductsByIds(tx, storeId, uniqueIds);

      if (existingProducts.length !== uniqueIds.length) {
        throw new NotFoundError("One or more products were not found");
      }

      const productIdsToDelete = existingProducts.map((product) => product.id);
      const variantSkusToDelete = await ProductRepository.findVariantSkusByProductIds(
        tx,
        storeId,
        productIdsToDelete,
      );
      const variantSkuList = variantSkusToDelete.map((variant) => variant.sku);

      await resetInventoryStocks(tx, variantSkuList);
      await ProductRepository.markProductVariantsDeletedByProductIds(tx, storeId, productIdsToDelete);
      await ProductRepository.markProductsDeleted(tx, storeId, productIdsToDelete);

      return {
        deleted_ids: productIdsToDelete,
      };
    }, PRISMA_INTERACTIVE_TRANSACTION_OPTIONS);

    await invalidateProductReadModels(storeId, result.deleted_ids);
    return result;
  },
};
