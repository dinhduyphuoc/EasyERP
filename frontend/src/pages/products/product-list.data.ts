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
  kind?: 'default' | 'generated'
  selling_price: string
  cogs: string
  image_url: string | null
  attribute_values: ProductVariantAttributeValue[]
}

export type ProductDetailItem = {
  id: number
  product_name: string
  default_variant_sku: string | null
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

export type ProductListItem = {
  id: number
  product_name: string
  default_variant_sku: string | null
  image_url: string | null
  status: 'active' | 'inactive' | 'draft' | 'deleted'
  category_id: number | null
  min_price: string | null
  max_price: string | null
  variant_count: number
  has_generated_variants: boolean
  primary_variant: {
    sku: string
    kind: 'default' | 'generated'
    selling_price: string
    image_url: string | null
  } | null
}

export const productSkeleton: ProductListItem = {
  id: 0,
  product_name: '',
  default_variant_sku: null,
  image_url: null,
  status: 'draft',
  category_id: null,
  min_price: null,
  max_price: null,
  variant_count: 0,
  has_generated_variants: false,
  primary_variant: null,
}

export const categoryLabelMap: Record<number, string> = {
  1: 'Phá»¥ kiá»‡n',
  2: 'Thá»i trang nam',
  3: 'Thá»i trang ná»¯',
}

export const mockProducts: ProductListItem[] = []
