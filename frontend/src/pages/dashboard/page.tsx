export function DashboardPage() {
  return (
    <section className="page-grid">
      <article className="hero-card">
        <p className="eyebrow">App layer</p>
        <h3>Frontend da duoc to chuc lai de phat trien theo domain</h3>
        <p>
          Router, layout va nhung page chinh da san sang. Tu day minh co the bo
          them feature products, orders, customers ma khong bi roi file.
        </p>
      </article>

      <article className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Suggested structure</p>
            <h3>Thu muc hien co</h3>
          </div>
        </div>
        <ul className="stack-list">
          <li>
            <code>app/</code> cho router, layout va bootstrap app.
          </li>
          <li>
            <code>pages/</code> cho page-level composition.
          </li>
          <li>
            <code>entities/</code> cho type, ui va model cua tung domain.
          </li>
          <li>
            <code>shared/</code> cho config, helper va reusable UI.
          </li>
        </ul>
      </article>
    </section>
  )
}
