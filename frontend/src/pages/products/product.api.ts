import { apiClient } from "@/api/api-client"
import type { ProductListItem } from './product-list.data'

const ENDPOINT = '/products'

export type ProductUpsertPayload = {
  product_name: string
  sku?: string
  unit?: string
  image_url?: string | null
  description?: string
  created_at?: string
  category_id?: number | null
  category?: string | null
  status?: 'active' | 'inactive' | 'draft' | 'deleted'
  base_price?: number | null
  cogs?: number | null
  attributes: Array<{
    name: string
    values: string[]
  }>
  variants: Array<{
    sku: string
    name?: string
    selling_price: number
    cogs: number
    combinations: string[]
  }>
}

export type ProductCategory = {
  id: number
  category_name: string
}

export type ProductImageUploadResult = {
  key: string
  image_url: string
}

type BulkDeletePayload = {
  ids: number[]
}

export type ProductBulkDeleteResult = {
  deleted_ids: number[]
}

let productCategoriesCache: ProductCategory[] | null = null
let productCategoriesPromise: Promise<ProductCategory[]> | null = null

function invalidateProductCategoriesCache() {
  productCategoriesCache = null
  productCategoriesPromise = null
}

export const productApi = {
  getProducts: async (params?: Record<string, any>): Promise<ProductListItem[]> => {
    return apiClient.get(ENDPOINT, { params })
  },

  getProductById: async (id: string | number): Promise<ProductListItem> => {
    return apiClient.get(`${ENDPOINT}/${id}`)
  },

  uploadProductImage: async (file: File): Promise<ProductImageUploadResult> => {
    const formData = new FormData()
    formData.append('image', file)

    return apiClient.post(`${ENDPOINT}/upload-image`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  getProductCategories: async (forceRefresh = false): Promise<ProductCategory[]> => {
    if (!forceRefresh && productCategoriesCache) {
      return productCategoriesCache
    }

    if (!forceRefresh && productCategoriesPromise) {
      return productCategoriesPromise
    }

    productCategoriesPromise = (apiClient
      .get(`${ENDPOINT}/categories`) as Promise<ProductCategory[]>)
      .then((categories: ProductCategory[]) => {
        productCategoriesCache = categories
        return categories
      })
      .finally(() => {
        productCategoriesPromise = null
      })

    return productCategoriesPromise
  },

  createProduct: async (data: ProductUpsertPayload): Promise<ProductListItem> => {
    return apiClient.post(ENDPOINT, data)
  },

  updateProduct: async (id: string | number, data: ProductUpsertPayload): Promise<ProductListItem> => {
    return apiClient.put(`${ENDPOINT}/${id}`, data)
  },

  deleteProducts: async (ids: number[]): Promise<ProductBulkDeleteResult> => {
    return apiClient.delete(ENDPOINT, { data: { ids } satisfies BulkDeletePayload })
  },

  getCategoryById: async (id: string | number): Promise<ProductCategory> => {
    return apiClient.get(`${ENDPOINT}/categories/${id}`)
  },

  createCategory: async (data: Pick<ProductCategory, 'category_name'>): Promise<ProductCategory> => {
    const category = await (apiClient.post(`${ENDPOINT}/categories`, data) as Promise<ProductCategory>)
    invalidateProductCategoriesCache()
    return category
  },

  updateCategory: async (id: string | number, data: Pick<ProductCategory, 'category_name'>): Promise<ProductCategory> => {
    const category = await (apiClient.put(`${ENDPOINT}/categories/${id}`, data) as Promise<ProductCategory>)
    invalidateProductCategoriesCache()
    return category
  },

  deleteCategories: async (ids: number[]): Promise<void> => {
    await apiClient.delete(`${ENDPOINT}/categories`, { data: { ids } satisfies BulkDeletePayload })
    invalidateProductCategoriesCache()
  },
}
