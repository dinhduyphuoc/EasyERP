import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">404</p>
          <h3>Khong tim thay trang</h3>
        </div>
      </div>
      <p>Route ban vua mo chua duoc khai bao trong frontend moi.</p>
      <Link className="text-link" to="/">
        Quay ve dashboard
      </Link>
    </section>
  )
}
