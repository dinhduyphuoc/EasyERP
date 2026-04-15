import { NavLink, Outlet } from 'react-router-dom'
import { navigationItems } from '@/shared/config/navigation'

export function RootLayout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span className="brand-kicker">EasyERP</span>
          <h1>Workspace</h1>
          <p>Khung frontend theo entity, sẵn router để mình phát triển từng domain.</p>
        </div>

        <nav className="nav-list" aria-label="Primary navigation">
          {navigationItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                isActive ? 'nav-link nav-link-active' : 'nav-link'
              }
            >
              <span className="nav-title">{item.label}</span>
              <span className="nav-description">{item.description}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="content-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">Entity-first frontend</p>
            <h2>Chuẩn bị sẵn routes, layout và chỗ đặt logic theo domain</h2>
          </div>
        </header>

        <Outlet />
      </main>
    </div>
  )
}
