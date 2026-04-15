import { ProductTablePreview } from '@/entities/product/ui/product-table-preview'

export function ProductsPage() {
  return (
    <section className="page-grid">
      <article className="hero-card">
        <p className="eyebrow">Products page</p>
        <h3>San cho ket noi API products va variants</h3>
        <p>
          Day la noi phu hop de dat filters, search va bang product variant sau
          nay.
        </p>
      </article>

      <ProductTablePreview />
    </section>
  )
}
