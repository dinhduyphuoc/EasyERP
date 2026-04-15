import type { ProductEntity } from '@/entities/product/model/types'

const demoProducts: ProductEntity[] = [
  {
    product_id: 57,
    product_name: 'Tui vai tote',
    sku: 'TVT',
    unit: 'cai',
    image_url: null,
    status: 'Dang ban',
    description: 'San pham mau de minh gan UI.',
    createdAt: '2026-04-14T12:00:00.000Z',
    category_id: 1,
    attributes: [
      {
        id: 1,
        name: 'Mau sac',
        values: [
          { id: 1, value: 'Kem' },
          { id: 2, value: 'Den' },
        ],
      },
      {
        id: 2,
        name: 'Size',
        values: [
          { id: 3, value: 'S' },
          { id: 4, value: 'M' },
        ],
      },
    ],
    variants: [
      {
        sku: 'TVT-KEM-S',
        selling_price: 180000,
        cost_price_ref: 120000,
        image_url: null,
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
        sku: 'TVT-DEN-M',
        selling_price: 195000,
        cost_price_ref: 130000,
        image_url: null,
        attribute_values: [
          {
            variant_sku: 'TVT-DEN-M',
            attribute_value_id: 2,
            attribute_value: { id: 2, value: 'Den', attribute_id: 1 },
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
]

export function ProductTablePreview() {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Entity / Product</p>
          <h3>Preview component</h3>
        </div>
        <span className="badge">Demo data</span>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Variants</th>
              <th>Status</th>
              <th>Attributes</th>
            </tr>
          </thead>
          <tbody>
            {demoProducts.map((product) => (
              <tr key={product.product_id}>
                <td>
                  <strong>{product.product_name}</strong>
                  <p>#{product.product_id}</p>
                </td>
                <td>
                  {product.variants.map((variant) => (
                    <p key={variant.sku}>{variant.sku}</p>
                  ))}
                </td>
                <td>{product.status ?? 'Draft'}</td>
                <td>
                  {product.variants.map((variant) => (
                    <p key={variant.sku}>
                      {variant.attribute_values
                        .map((item) => item.attribute_value.value)
                        .join(' / ')}
                    </p>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
