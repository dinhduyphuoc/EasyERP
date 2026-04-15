export interface ProductVariantAttributeValue {
  variant_sku: string
  attribute_value_id: number
  attribute_value: {
    id: number
    value: string
    attribute_id: number
  }
}

export interface ProductVariant {
  sku: string
  selling_price: string | number
  cost_price_ref: string | number
  image_url?: string | null
  attribute_values: ProductVariantAttributeValue[]
}

export interface ProductAttribute {
  id: number
  name: string
  values: Array<{
    id: number
    value: string
  }>
}

export interface ProductEntity {
  product_id: number
  product_name: string
  sku?: string | null
  unit?: string | null
  image_url?: string | null
  status?: string | null
  description?: string | null
  createdAt: string
  category_id?: number | null
  attributes: ProductAttribute[]
  variants: ProductVariant[]
}
