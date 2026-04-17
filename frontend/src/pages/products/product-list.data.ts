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
  cost_price_ref: string
  image_url: string | null
  attribute_values: ProductVariantAttributeValue[]
}

export type ProductListItem = {
  product_id: number
  product_name: string
  sku: string | null
  unit: string | null
  image_url: string | null
  status: string | null
  description: string | null
  createdAt: string
  category_id: number | null
  attributes: ProductAttribute[]
  variants: ProductVariant[]
}

export const productSkeleton: ProductListItem = {
  product_id: 0,
  product_name: '',
  sku: null,
  unit: null,
  image_url: null,
  status: null,
  description: null,
  createdAt: new Date().toISOString(),
  category_id: null,
  attributes: [],
  variants: [],
}

export const categoryLabelMap: Record<number, string> = {
  1: 'Phụ kiện',
  2: 'Thời trang nam',
  3: 'Thời trang nữ',
}

export const mockProducts: ProductListItem[] = [
  {
    product_id: 2,
    product_name: 'Túi vải tote',
    sku: null,
    unit: 'cái',
    image_url:
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=300&q=80',
    status: 'Đang bán',
    description: 'Túi vải tote phong cách tối giản, phù hợp đi học và đi làm',
    createdAt: '2026-04-16T15:08:19.164Z',
    category_id: 1,
    attributes: [
      {
        id: 1,
        name: 'Màu sắc',
        product_id: 2,
        values: [
          { id: 1, value: 'Kem', attribute_id: 1 },
          { id: 2, value: 'Đen', attribute_id: 1 },
        ],
      },
      {
        id: 2,
        name: 'Size',
        product_id: 2,
        values: [
          { id: 3, value: 'S', attribute_id: 2 },
          { id: 4, value: 'M', attribute_id: 2 },
        ],
      },
    ],
    variants: [
      {
        sku: 'TVT-KEM-S',
        product_id: 2,
        selling_price: '180000',
        cost_price_ref: '120000',
        image_url:
          'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=300&q=80',
        attribute_values: [
          {
            variant_sku: 'TVT-KEM-S',
            attribute_value_id: 1,
            attribute_value: { id: 1, value: 'Kem', attribute_id: 1 },
          },
          {
            variant_sku: 'TVT-KEM-S',
            attribute_value_id: 3,
            attribute_value: { id: 3, value: 'S', attribute_id: 2 },
          },
        ],
      },
      {
        sku: 'TVT-KEM-M',
        product_id: 2,
        selling_price: '190000',
        cost_price_ref: '125000',
        image_url:
          'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=300&q=80',
        attribute_values: [
          {
            variant_sku: 'TVT-KEM-M',
            attribute_value_id: 1,
            attribute_value: { id: 1, value: 'Kem', attribute_id: 1 },
          },
          {
            variant_sku: 'TVT-KEM-M',
            attribute_value_id: 4,
            attribute_value: { id: 4, value: 'M', attribute_id: 2 },
          },
        ],
      },
      {
        sku: 'TVT-DEN-S',
        product_id: 2,
        selling_price: '180000',
        cost_price_ref: '120000',
        image_url:
          'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=300&q=80',
        attribute_values: [
          {
            variant_sku: 'TVT-DEN-S',
            attribute_value_id: 2,
            attribute_value: { id: 2, value: 'Đen', attribute_id: 1 },
          },
          {
            variant_sku: 'TVT-DEN-S',
            attribute_value_id: 3,
            attribute_value: { id: 3, value: 'S', attribute_id: 2 },
          },
        ],
      },
      {
        sku: 'TVT-DEN-M',
        product_id: 2,
        selling_price: '190000',
        cost_price_ref: '125000',
        image_url:
          'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=300&q=80',
        attribute_values: [
          {
            variant_sku: 'TVT-DEN-M',
            attribute_value_id: 2,
            attribute_value: { id: 2, value: 'Đen', attribute_id: 1 },
          },
          {
            variant_sku: 'TVT-DEN-M',
            attribute_value_id: 4,
            attribute_value: { id: 4, value: 'M', attribute_id: 2 },
          },
        ],
      },
    ],
  },
  {
    product_id: 3,
    product_name: 'Áo thun oversize basic',
    sku: 'AT-OVERSIZE',
    unit: 'cái',
    image_url:
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=300&q=80',
    status: 'Đang bán',
    description: 'Áo thun form rộng cotton dày dặn, mặc thường ngày dễ phối đồ',
    createdAt: '2026-04-15T09:30:00.000Z',
    category_id: 2,
    attributes: [
      {
        id: 5,
        name: 'Màu sắc',
        product_id: 3,
        values: [
          { id: 5, value: 'Trắng', attribute_id: 5 },
          { id: 6, value: 'Xám', attribute_id: 5 },
        ],
      },
      {
        id: 6,
        name: 'Size',
        product_id: 3,
        values: [
          { id: 7, value: 'M', attribute_id: 6 },
          { id: 8, value: 'L', attribute_id: 6 },
          { id: 9, value: 'XL', attribute_id: 6 },
        ],
      },
    ],
    variants: [
      {
        sku: 'AT-OV-TRANG-M',
        product_id: 3,
        selling_price: '240000',
        cost_price_ref: '150000',
        image_url:
          'https://images.unsplash.com/photo-1527719327859-c6ce80353573?auto=format&fit=crop&w=300&q=80',
        attribute_values: [],
      },
      {
        sku: 'AT-OV-TRANG-L',
        product_id: 3,
        selling_price: '240000',
        cost_price_ref: '150000',
        image_url:
          'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=300&q=80',
        attribute_values: [],
      },
      {
        sku: 'AT-OV-XAM-XL',
        product_id: 3,
        selling_price: '250000',
        cost_price_ref: '155000',
        image_url:
          'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=300&q=80',
        attribute_values: [],
      },
    ],
  },
  {
    product_id: 4,
    product_name: 'Đầm maxi hoa nhí',
    sku: 'DAM-MAXI-HOA',
    unit: 'cái',
    image_url:
      'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=300&q=80',
    status: 'Sắp hết',
    description: 'Đầm maxi nhẹ, họa tiết hoa nhí, phù hợp đi biển và dạo phố',
    createdAt: '2026-04-12T10:15:00.000Z',
    category_id: 3,
    attributes: [
      {
        id: 7,
        name: 'Size',
        product_id: 4,
        values: [
          { id: 10, value: 'S', attribute_id: 7 },
          { id: 11, value: 'M', attribute_id: 7 },
        ],
      },
    ],
    variants: [
      {
        sku: 'DAM-MAXI-S',
        product_id: 4,
        selling_price: '520000',
        cost_price_ref: '330000',
        image_url:
          'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=300&q=80',
        attribute_values: [],
      },
      {
        sku: 'DAM-MAXI-M',
        product_id: 4,
        selling_price: '520000',
        cost_price_ref: '330000',
        image_url:
          'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=300&q=80',
        attribute_values: [],
      },
    ],
  },
  {
    product_id: 5,
    product_name: 'Thắt lưng da khóa kim',
    sku: 'TL-DA-KHOA-KIM',
    unit: 'cái',
    image_url:
      'https://images.unsplash.com/photo-1622560480654-d96214fdc887?auto=format&fit=crop&w=300&q=80',
    status: 'Hết hàng',
    description: 'Thắt lưng da công sở, mặt khóa kim tối giản',
    createdAt: '2026-04-10T08:45:00.000Z',
    category_id: 1,
    attributes: [],
    variants: [
      {
        sku: 'TL-DA-100',
        product_id: 5,
        selling_price: '290000',
        cost_price_ref: '180000',
        image_url:
          'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=300&q=80',
        attribute_values: [],
      },
    ],
  },
]
