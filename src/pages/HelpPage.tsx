import type { ReactNode } from 'react';
import { WIDGETS, DATA_SOURCES } from '../lib/widgetCatalog';

function Code({ children }: { children: ReactNode }) {
  return <span className="doc-inline">{children}</span>;
}

function Json({ value }: { value: unknown }) {
  return <pre className="doc-code">{JSON.stringify(value, null, 2)}</pre>;
}

export function HelpPage() {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Help &amp; Reference</h1>
          <p className="page-desc">How the backoffice drives the Condorito app, and how to configure screens.</p>
        </div>
      </div>

      <div className="doc-section">
        <h2>How it works</h2>
        <p>
          This backoffice writes directly to the Condorito database. The app reads that data through two
          edge functions, so your changes reach the app without a new release.
        </p>
        <div className="card doc-card">
          <p style={{ marginBottom: 6 }}>
            <strong>Configuration</strong> (Localization, Configuration, Navigation) is served by{' '}
            <Code>get-product-config</Code>. Everything is scoped to the <strong>Product</strong> selected in the
            top bar. Running apps cache config for ~10 minutes, so changes appear within that window.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Screens</strong> are served by <Code>condorito-screen</Code>. A screen only replaces the app’s
            built-in layout when the screen <em>and</em> at least one section are <strong>Active</strong>; otherwise
            the app falls back to its default layout. Screen changes are not cached and appear on the next load.
          </p>
        </div>
      </div>

      <div className="doc-section">
        <h2>Screens &amp; sections</h2>
        <p>
          A screen’s <Code>slug</Code> must match what the app requests. Valid slugs:{' '}
          <Code>home</Code>, <Code>freemium</Code>, <Code>colecciones</Code>, <Code>colecciones-search</Code>,{' '}
          <Code>colecciones-category</Code>, <Code>personajes</Code>, <Code>comic-detail</Code>.
        </p>
        <p>
          Each section has a <strong>type</strong> (a widget the app knows) and a <strong>config</strong> (JSON).
          Sections render top-to-bottom by position. Config holds the widget’s static props, plus two optional
          reserved keys:
        </p>
        <div className="card doc-card">
          <p style={{ marginBottom: 4 }}>
            <Code>i18n</Code> — translate a prop by key. The literal value stays as the fallback.
          </p>
          <Json value={{ i18n: { title: 'home.acerca_de_mi' }, title: 'Acerca de Mí' }} />
          <p style={{ margin: '14px 0 4px' }}>
            <Code>data_binding</Code> — fill dynamic content from a data source (see below).
          </p>
          <Json value={{ data_binding: { source: 'characters', limit: 10, itemAction: 'navigate', route: '/personajes' } }} />
        </div>
        <p style={{ marginTop: 14 }}>
          <strong>Audience</strong> — limit who sees a section (filtered by the app):
        </p>
        <div className="card table-wrap" style={{ marginTop: 8 }}>
          <table>
            <thead>
              <tr>
                <th>Value</th>
                <th>Who sees it</th>
              </tr>
            </thead>
            <tbody>
              <tr><td><span className="cell-mono">all</span></td><td>Everyone (default)</td></tr>
              <tr><td><span className="cell-mono">guest</span></td><td>Not logged in — use for <strong>Area Libre</strong></td></tr>
              <tr><td><span className="cell-mono">logged_in</span></td><td>Signed-in users — e.g. continue-reading rail</td></tr>
              <tr><td><span className="cell-mono">non_premium</span></td><td>Guests + free users — use for <strong>Subscribe</strong> banner</td></tr>
            </tbody>
          </table>
        </div>
        <p style={{ marginTop: 12, fontSize: 13, color: 'var(--text-muted)' }}>
          Use <strong>Section presets</strong> when adding a section on the Screens page — Area Libre,
          Subscribe, and Continua Leyendo include the correct <code>audience</code> / <code>variant</code>.
        </p>
      </div>

      <div className="doc-section">
        <h2>Data sources</h2>
        <p>Used in <Code>data_binding.source</Code> to populate a widget’s items (or an inline PDF).</p>
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Params</th>
                <th>Fills</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {DATA_SOURCES.map((s) => (
                <tr key={s.source}>
                  <td><span className="cell-mono">{s.source}</span></td>
                  <td><span className="cell-mono">{s.params}</span></td>
                  <td><span className="cell-mono">{s.fills}</span></td>
                  <td>{s.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="doc-section">
        <h2>Character tap behavior</h2>
        <p>
          Character detail is an overlay opened by <Code>show_detail</Code>, not a screen section type.
          Configure the action on each character-bound section so the same avatar widget can behave differently by screen.
        </p>
        <div className="card doc-card">
          <p style={{ marginBottom: 4 }}><strong>Home:</strong> navigate to the Personajes screen.</p>
          <Json value={{ data_binding: { source: 'characters', limit: 14, itemAction: 'navigate', route: '/personajes' } }} />
          <p style={{ margin: '14px 0 4px' }}><strong>Personajes:</strong> open the selected character’s detail sheet.</p>
          <Json value={{ data_binding: { source: 'characters', itemAction: 'show_detail' } }} />
        </div>
      </div>

      <div className="doc-section">
        <h2>Widget reference</h2>
        <p>Set a section’s type to one of these and use the example as a starting config.</p>
        {WIDGETS.map((w) => (
          <div className="card doc-card" key={w.type}>
            <div className="doc-head-row" style={{ marginBottom: 6 }}>
              <span className="doc-inline">{w.type}</span>
              <strong style={{ fontSize: 14 }}>{w.label}</strong>
              <span className={`tag${w.binding !== 'none' ? ' tag-binding' : ''}`}>
                {w.binding === 'none'
                  ? 'static'
                  : w.binding === 'special'
                    ? 'binding: special'
                    : 'binding: items'}
              </span>
            </div>
            <p style={{ margin: 0 }}>{w.description}</p>
            {w.sources.length > 0 && (
              <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--text-faint)' }}>
                Sources: {w.sources.map((s) => <span key={s} className="cell-mono" style={{ marginRight: 8 }}>{s}</span>)}
              </p>
            )}
            <Json value={w.example} />
          </div>
        ))}
      </div>

      <div className="doc-section">
        <h2>Actions</h2>
        <p>
          Interactive props (e.g. <Code>ctaAction</Code>, <Code>headerAction.action</Code>, or an item’s{' '}
          <Code>action</Code>) use these types:
        </p>
        <div className="card doc-card">
          <Json
            value={{
              navigate: { type: 'navigate', route: '/colecciones' },
              open_reader: { type: 'open_reader', data: { pdfUrl: 'https://…', title: 'Título' } },
              premium_gate: { type: 'premium_gate' },
              show_subscription: { type: 'show_subscription' },
              show_detail: {
                type: 'show_detail',
                data: {
                  slug: 'condorito',
                  name: 'Condorito',
                  bio: '…',
                  imageUrl: 'https://…',
                },
              },
              go_back: { type: 'go_back' },
            }}
          />
        </div>
      </div>
    </div>
  );
}
