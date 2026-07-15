import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, MonitorSmartphone, HelpCircle, LogOut, Menu as MenuIcon } from 'lucide-react';
import { VISIBLE_RESOURCES, VISIBLE_GROUPS } from '../lib/resources';
import { ResourceIcon } from '../components/ResourceIcon';
import { useAuth } from '../lib/AuthContext';
import { useProduct } from '../lib/ProductContext';

export function AppLayout() {
  const { user, signOut } = useAuth();
  const { products, productId, setProductId } = useProduct();
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  return (
    <div className="app-shell">
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">C</div>
          <div>
            <div className="brand-text">Condorito</div>
            <div className="brand-sub">Backoffice</div>
          </div>
        </div>

        <nav className="nav-group">
          <NavLink to="/" end className="nav-item" onClick={close}>
            <LayoutDashboard size={17} />
            Dashboard
          </NavLink>
          <NavLink to="/screens" className="nav-item" onClick={close}>
            <MonitorSmartphone size={17} />
            App Screens
          </NavLink>
          <NavLink to="/help" className="nav-item" onClick={close}>
            <HelpCircle size={17} />
            Help &amp; Reference
          </NavLink>
        </nav>

        {VISIBLE_GROUPS.map((group) => (
          <div className="nav-group" key={group}>
            <div className="nav-group-label">{group}</div>
            {VISIBLE_RESOURCES.filter((r) => r.group === group).map((r) => (
              <NavLink key={r.key} to={`/r/${r.key}`} className="nav-item" onClick={close}>
                <ResourceIcon name={r.icon} />
                {r.label}
              </NavLink>
            ))}
          </div>
        ))}
      </aside>

      <div className={`overlay-mask${open ? ' show' : ''}`} onClick={close} />

      <div className="main">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn-icon burger" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
              <MenuIcon size={20} />
            </button>
            {products.length > 0 && (
              <div className="pill-select">
                <label htmlFor="product">Product</label>
                <select id="product" value={productId ?? ''} onChange={(e) => setProductId(e.target.value)}>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name}
                      {p.environment ? ` (${p.environment})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{user?.email}</span>
            <button className="btn btn-ghost btn-sm" onClick={signOut}>
              <LogOut size={15} />
              Sign out
            </button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
