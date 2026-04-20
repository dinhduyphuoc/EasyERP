export type ProductAttributeValue = {
  id: number
  value: string
  attribute_id: number
}

export type ProductAttribute = {
  id: number
  name: string
  product_id: number
  values: ProductAttributeValue[]
}

export type ProductVariantAttributeValue = {
  variant_sku: string
  attribute_value_id: number
  attribute_value: ProductAttributeValue
}

export type ProductVariant = {
  sku: string
  product_id: number
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
  created_at: string
  updated_at?: string
  category_id: number | null
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
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  category_id: null,
  attributes: [],
  variants: [],
}

export const categoryLabelMap: Record<number, string> = {
  1: 'Phụ kiện',
  2: 'Thời trang nam',
  3: 'Thời trang nữ',
}

export const mockProducts: ProductListItem[] = []
