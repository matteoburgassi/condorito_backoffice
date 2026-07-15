import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MonitorSmartphone } from 'lucide-react';
import { VISIBLE_RESOURCES, VISIBLE_GROUPS } from '../lib/resources';
import { ResourceIcon } from '../components/ResourceIcon';
import { supabase } from '../lib/supabase';
import { useProduct } from '../lib/ProductContext';

const STAT_TABLES: { table: string; label: string; scoped: boolean }[] = [
  { table: 'product_translations', label: 'Translations', scoped: true },
  { table: 'product_feature_flags', label: 'Feature flags', scoped: true },
  { table: 'product_menu_items', label: 'Menu items', scoped: true },
  { table: 'product_screens', label: 'Screens', scoped: true },
];

export function DashboardHome() {
  const { current, productId } = useProduct();
  const [counts, setCounts] = useState<Record<string, number | null>>({});

  useEffect(() => {
    let active = true;
    (async () => {
      const entries = await Promise.all(
        STAT_TABLES.map(async (s) => {
          let q = supabase.from(s.table).select('*', { count: 'exact', head: true });
          if (s.scoped && productId) q = q.eq('product_id', productId);
          const { count, error } = await q;
          return [s.table, error ? null : count ?? 0] as const;
        })
      );
      if (active) setCounts(Object.fromEntries(entries));
    })();
    return () => {
      active = false;
    };
  }, [productId]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-desc">
            Manage the content and configuration the Condorito app reads
            {current ? ` · ${current.display_name}` : ''}.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
        {STAT_TABLES.map((s) => (
          <div className="card" key={s.table} style={{ padding: 18 }}>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {s.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>
              {counts[s.table] == null ? '—' : counts[s.table]}
            </div>
          </div>
        ))}
      </div>

      <Link to="/screens" className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 20, marginBottom: 28 }}>
        <div className="brand-mark" style={{ background: 'var(--surface-3)', color: 'var(--accent)' }}>
          <MonitorSmartphone size={18} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>App Screens</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Compose data-driven layouts by reordering and editing sections.</div>
        </div>
        <ArrowRight size={18} style={{ color: 'var(--text-muted)' }} />
      </Link>

      {VISIBLE_GROUPS.map((group) => (
        <div key={group} style={{ marginBottom: 24 }}>
          <div className="nav-group-label" style={{ padding: '0 0 10px' }}>{group}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {VISIBLE_RESOURCES.filter((r) => r.group === group).map((r) => (
              <Link key={r.key} to={`/r/${r.key}`} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
                <div style={{ color: 'var(--primary)' }}>
                  <ResourceIcon name={r.icon} size={18} />
                </div>
                <span style={{ fontWeight: 500, fontSize: 14 }}>{r.label}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
