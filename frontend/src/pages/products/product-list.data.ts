export type ProductAttributeValue = {
  id: number
  value: string
  attributeId: number
}

export type ProductAttribute = {
  id: number
  name: string
  productId: number
  values: ProductAttributeValue[]
}

export type ProductVariantAttributeValue = {
  variant_sku: string
  attributeValueId: number
  attribute_value: ProductAttributeValue
}

export type ProductVariant = {
  sku: string
  productId: number
  selling_price: string
  cogs: string
  image_url: string | null
  attribute_values: ProductVariantAttributeValue[]
}

export type ProductListItem = {
  id: number
  product_name: string
  sku: string | null
  unit: string | null
  base_price?: string | null
  cogs?: string | null
  image_url: string | null
  status: 'active' | 'inactive' | 'draft' | 'deleted'
  description: string | null
  createdAt: string
  updatedAt?: string
  categoryId: number | null
  attributes: ProductAttribute[]
  variants: ProductVariant[]
}

export const productSkeleton: ProductListItem = {
  id: 0,
  product_name: '',
  sku: null,
  unit: null,
  image_url: null,
  status: 'draft',
  description: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  categoryId: null,
  attributes: [],
  variants: [],
}

export const categoryLabelMap: Record<number, string> = {
  1: 'Phụ kiện',
  2: 'Thời trang nam',
  3: 'Thời trang nữ',
}

export const mockProducts: ProductListItem[] = []
