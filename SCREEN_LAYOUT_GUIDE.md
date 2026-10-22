# Screen Layout Builder – Implementation Guide

This guide describes how to rebuild the **App Screens** layout builder in another Back Office (BO) panel. It covers the database, the Supabase Edge Function consumed by the app, and the BO page used by admins.

Scope: **layout composition, ordering and grid width**. Content-specific data sources are out of scope; each section carries its own static configuration.

---

## 1. How it works

### 1.1 Concepts

| Concept | Description |
|---|---|
| **Screen** | A named layout requested by the app, identified by a `slug` (e.g. `home`) that is unique per product. A screen can be switched on/off. |
| **Section** | One widget inside a screen. It has a `type` (which widget the app renders), a JSON `config` (widget props), a `position`, an active flag, a platform (Mobile or Desktop) and a grid width. |
| **Platform** | Every section belongs to exactly one platform: Mobile (`is_desktop = false`) or Desktop (`is_desktop = true`). Each platform has its own independent ordering. |
| **Grid cells** | Width of the section in a 12-column grid, from `1` to `12`. Default `12` (full width). |

### 1.2 Ordering

- Sections are returned sorted by `position` ascending.
- Positions are independent per platform: Mobile sections are numbered `0..n` and Desktop sections are numbered `0..m`.
- The BO lets admins reorder with drag-and-drop or with up/down arrows; after every change the positions of the visible platform are rewritten as `0, 1, 2, ...`.
- New sections are appended at the end of their platform (`max(position) + 1`).
- When a section is moved to the other platform, it is appended at the end of that platform.

### 1.3 Grid

- The app renders sections in a 12-column grid. A section with `gridCells: 6` takes half a row, `4` a third, `12` the full row.
- Consecutive sections wrap onto a new row when the sum of their cells exceeds 12.
- Invalid or missing values always fall back to `12`, both in the database (check constraint + default) and in the server function (`normalizeGridCells`).

### 1.4 Mobile / Desktop fallback

When the app requests a platform:

1. If the screen has **active sections for that platform**, those are returned.
2. Otherwise the **active sections of the other platform** are returned.

So a screen built only for Mobile is also served on Desktop, and vice versa. As soon as at least one active section exists on both platforms, each platform gets its own layout.

### 1.5 Flow

```
BO admin  ──writes──▶  screens / screen_sections  ◀──reads──  Edge Function "screen-layout"  ◀──GET──  App
```

### 1.6 Response contract

```http
GET /functions/v1/screen-layout?product_id=<uuid>&screen=home&platform=desktop
```

```json
{
  "screen": "home",
  "platform": "desktop",
  "widgets": [
    { "type": "banner", "key": "section_9f1c...", "gridCells": 12, "title": "Welcome" },
    { "type": "carousel", "key": "news", "gridCells": 8, "title": "News", "items": [] },
    { "type": "text", "key": "section_51aa...", "gridCells": 4, "body": "Hello", "showTitle": false }
  ]
}
```

- `type`: the section type.
- `key`: `config.key` when set, otherwise `section_<id>`. Unique within the screen.
- `gridCells`: the section width (1–12).
- Every other top-level property of `config` is copied as-is (e.g. `title`, `showTitle`, colours, actions).
- `config.data_binding = { "source": "static", "items": [...] }` populates `items`.
- `showTitle: false` tells the app to hide the widget title.

---

## 2. Database

Run this as a single migration. Two placeholders must be adapted:

- `public.products(id)`: replace with your products table.
- `public.is_admin()`: replace with your **existing** admin check (function, role claim, or membership query). Keep the same signature, or replace each `is_admin()` call in the policies.

```sql
/*
  # Screen layout builder

  1. New tables
    - `screens`: one layout per product + slug.
    - `screen_sections`: ordered widgets of a screen, per platform, with grid width.
  2. Security
    - RLS enabled on both tables.
    - Anyone can read active screens and active sections of active screens.
    - Only admins can read everything and create, update, delete.
*/

CREATE TABLE IF NOT EXISTS screens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS screens_product_slug_key
  ON screens (product_id, slug);

CREATE TABLE IF NOT EXISTS screen_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_id uuid NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  type text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_desktop boolean NOT NULL DEFAULT false,
  grid_cells smallint NOT NULL DEFAULT 12
    CONSTRAINT screen_sections_grid_cells_range CHECK (grid_cells BETWEEN 1 AND 12),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_screen_sections_screen_platform_position
  ON screen_sections (screen_id, is_desktop, position);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS screens_updated_at ON screens;
CREATE TRIGGER screens_updated_at BEFORE UPDATE ON screens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS screen_sections_updated_at ON screen_sections;
CREATE TRIGGER screen_sections_updated_at BEFORE UPDATE ON screen_sections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE screen_sections ENABLE ROW LEVEL SECURITY;

-- screens
CREATE POLICY "public_read_active_screens" ON screens FOR SELECT
  TO anon, authenticated USING (is_active);
CREATE POLICY "admin_select_all_screens" ON screens FOR SELECT
  TO authenticated USING (is_admin());
CREATE POLICY "admin_insert_screens" ON screens FOR INSERT
  TO authenticated WITH CHECK (is_admin());
CREATE POLICY "admin_update_screens" ON screens FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "admin_delete_screens" ON screens FOR DELETE
  TO authenticated USING (is_admin());

-- screen_sections
CREATE POLICY "public_read_active_screen_sections" ON screen_sections FOR SELECT
  TO anon, authenticated USING (
    is_active AND EXISTS (
      SELECT 1 FROM screens s WHERE s.id = screen_sections.screen_id AND s.is_active
    )
  );
CREATE POLICY "admin_select_all_screen_sections" ON screen_sections FOR SELECT
  TO authenticated USING (is_admin());
CREATE POLICY "admin_insert_screen_sections" ON screen_sections FOR INSERT
  TO authenticated WITH CHECK (is_admin());
CREATE POLICY "admin_update_screen_sections" ON screen_sections FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "admin_delete_screen_sections" ON screen_sections FOR DELETE
  TO authenticated USING (is_admin());
```

### 2.1 Sample data (optional)

A Mobile-only `home` screen. Requesting `platform=desktop` returns these same sections (fallback).

```sql
DO $$
DECLARE
  v_product uuid := (SELECT id FROM products ORDER BY created_at LIMIT 1);
  v_screen uuid;
BEGIN
  IF v_product IS NULL THEN RETURN; END IF;

  INSERT INTO screens (product_id, slug, title)
  VALUES (v_product, 'home', 'Home')
  ON CONFLICT (product_id, slug) DO NOTHING
  RETURNING id INTO v_screen;

  IF v_screen IS NULL THEN RETURN; END IF;

  INSERT INTO screen_sections (screen_id, type, config, position, is_desktop, grid_cells) VALUES
    (v_screen, 'banner', '{"title":"Welcome","subtitle":"Start here"}', 0, false, 12),
    (v_screen, 'carousel', '{"key":"news","title":"News","data_binding":{"source":"static","items":[]}}', 1, false, 8),
    (v_screen, 'text', '{"title":"About","showTitle":false,"body":"Hello"}', 2, false, 4);
END $$;
```

---

## 3. Edge Function `screen-layout`

Files:

```
supabase/functions/_shared/cors.ts
supabase/functions/_shared/screen-layout.ts
supabase/functions/_shared/screen-platform.ts
supabase/functions/screen-layout/index.ts
```

`supabase/config.toml`:

```toml
[functions.screen-layout]
verify_jwt = false
```

`verify_jwt = false` lets the app call it with the public anon key only. The function only returns active content.

### 3.1 `_shared/cors.ts`

```ts
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  return null;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status);
}
```

### 3.2 `_shared/screen-layout.ts`

```ts
export const DEFAULT_GRID_CELLS = 12;

export function normalizeGridCells(value: unknown): number {
  return typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= DEFAULT_GRID_CELLS
    ? value
    : DEFAULT_GRID_CELLS;
}

export function withGridCells<T extends Record<string, unknown>>(
  widget: T,
  value: unknown,
): T & { gridCells: number } {
  return {
    ...widget,
    gridCells: normalizeGridCells(value),
  };
}
```

### 3.3 `_shared/screen-platform.ts`

```ts
export type ScreenPlatform = "mobile" | "desktop";

export function parseScreenPlatform(value: string | null): ScreenPlatform {
  return value === "desktop" ? "desktop" : "mobile";
}

// Falls back to the other platform when the requested one has no sections.
export function selectSectionsForPlatform<T extends { is_desktop: boolean }>(
  sections: T[],
  platform: ScreenPlatform,
): T[] {
  const wantDesktop = platform === "desktop";
  const own = sections.filter((s) => s.is_desktop === wantDesktop);
  if (own.length > 0) return own;
  return sections.filter((s) => s.is_desktop !== wantDesktop);
}
```

### 3.4 `screen-layout/index.ts`

```ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { withGridCells } from "../_shared/screen-layout.ts";
import {
  parseScreenPlatform,
  selectSectionsForPlatform,
} from "../_shared/screen-platform.ts";

interface ScreenSection {
  id: string;
  type: string;
  position: number;
  config: Record<string, unknown> | null;
  is_desktop: boolean;
  grid_cells: number;
}

const RESERVED_KEYS = new Set(["key", "data_binding", "gridCells"]);

Deno.serve(async (req: Request) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const url = new URL(req.url);
    const productId = url.searchParams.get("product_id");
    const screen = url.searchParams.get("screen") ?? "home";
    const platform = parseScreenPlatform(url.searchParams.get("platform"));
    if (!productId) return errorResponse("Missing product_id parameter", 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: screenRow, error: screenError } = await supabase
      .from("screens")
      .select("id")
      .eq("product_id", productId)
      .eq("slug", screen)
      .eq("is_active", true)
      .maybeSingle();
    if (screenError) throw screenError;
    if (!screenRow) return errorResponse(`Unknown screen: ${screen}`, 404);

    const { data: sections, error: sectionsError } = await supabase
      .from("screen_sections")
      .select("id, type, position, config, is_desktop, grid_cells")
      .eq("screen_id", screenRow.id)
      .eq("is_active", true)
      .order("position", { ascending: true });
    if (sectionsError) throw sectionsError;

    const selected = selectSectionsForPlatform(
      (sections ?? []) as ScreenSection[],
      platform,
    );

    return jsonResponse({
      screen,
      platform,
      widgets: selected.map(sectionToWidget),
    });
  } catch (err) {
    return errorResponse((err as Error).message);
  }
});

function sectionToWidget(section: ScreenSection) {
  const cfg = section.config ?? {};
  const widget: Record<string, unknown> = withGridCells(
    {
      type: section.type,
      key: typeof cfg.key === "string" && cfg.key ? cfg.key : `section_${section.id}`,
    },
    section.grid_cells,
  );

  for (const [k, v] of Object.entries(cfg)) {
    if (RESERVED_KEYS.has(k)) continue;
    widget[k] = v;
  }

  const binding = cfg.data_binding as { source?: string; items?: unknown } | undefined;
  if (binding?.source === "static" && Array.isArray(binding.items)) {
    widget.items = binding.items;
  }

  return widget;
}
```

### 3.5 Behaviour summary

| Case | Result |
|---|---|
| Missing `product_id` | `400` |
| Screen not found or inactive | `404` |
| Screen active, no active sections | `200` with `widgets: []` |
| Requested platform has active sections | Those sections, by position |
| Requested platform has none | Active sections of the other platform, by position |
| `grid_cells` invalid | `gridCells: 12` |

---

## 4. Back Office page

Prerequisites in the BO project: React 18, `@supabase/supabase-js`, `lucide-react`, an existing Supabase client and admin authentication. The page receives the current `productId` as a prop; wire it to your own product selector.

Files:

```
src/lib/screenSections.ts
src/lib/widgetCatalog.ts
src/components/Modal.tsx
src/components/ConfirmDialog.tsx
src/components/Switch.tsx
src/components/Spinner.tsx
src/pages/ScreensPage.tsx
tests/screenSections.test.ts
```

### 4.1 `src/lib/screenSections.ts`

```ts
export type SectionPlatform = 'mobile' | 'desktop';
export const DEFAULT_GRID_CELLS = 12;

export interface PlatformSection {
  position: number;
  is_desktop: boolean;
}

export function isDesktopPlatform(platform: SectionPlatform): boolean {
  return platform === 'desktop';
}

export function sectionsForPlatform<T extends PlatformSection>(
  sections: T[],
  platform: SectionPlatform,
): T[] {
  const desktop = isDesktopPlatform(platform);
  return sections.filter((section) => section.is_desktop === desktop);
}

export function nextSectionPosition(
  sections: PlatformSection[],
  isDesktop: boolean,
): number {
  return sections
    .filter((section) => section.is_desktop === isDesktop)
    .reduce((max, section) => Math.max(max, section.position), -1) + 1;
}

export function normalizeGridCells(value: unknown): number {
  return typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= DEFAULT_GRID_CELLS
    ? value
    : DEFAULT_GRID_CELLS;
}

export function withoutLegacyGridCells(config: unknown): unknown {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return config;
  const next = { ...(config as Record<string, unknown>) };
  delete next.gridCells;
  return next;
}

export function parseConfigJson(text: string): { config: Record<string, unknown> | null; error: string | null } {
  if (text.trim() === '') return { config: {}, error: null };
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { config: null, error: 'Config must be a JSON object.' };
    }
    return { config: parsed as Record<string, unknown>, error: null };
  } catch {
    return { config: null, error: 'Config must be valid JSON.' };
  }
}
```

### 4.2 `src/lib/widgetCatalog.ts`

Replace these entries with the widget types your app renders. `defaultConfig` is loaded when the type is selected.

```ts
export interface WidgetDefinition {
  type: string;
  label: string;
  description: string;
  defaultConfig: Record<string, unknown>;
  desktopOnly?: boolean;
}

export const WIDGETS: WidgetDefinition[] = [
  {
    type: 'banner',
    label: 'Banner',
    description: 'Full-width promotional block with title, subtitle and call to action.',
    defaultConfig: { title: 'Title', subtitle: '', ctaLabel: '', ctaAction: { type: 'navigate', route: '/' } },
  },
  {
    type: 'carousel',
    label: 'Carousel',
    description: 'Horizontal list of cards.',
    defaultConfig: { title: 'Carousel', data_binding: { source: 'static', items: [] } },
  },
  {
    type: 'grid',
    label: 'Grid',
    description: 'Cards in columns.',
    defaultConfig: { title: 'Grid', columns: 2, data_binding: { source: 'static', items: [] } },
  },
  {
    type: 'text',
    label: 'Text',
    description: 'Title and paragraph.',
    defaultConfig: { title: 'Text', body: '' },
  },
  {
    type: 'footer',
    label: 'Footer',
    description: 'Links and copyright at the bottom of the screen.',
    defaultConfig: { items: [], copyright: '' },
  },
];

export function defaultConfigForWidget(widget: WidgetDefinition): Record<string, unknown> {
  return structuredClone(widget.defaultConfig);
}
```

### 4.3 Shared components

`src/components/Modal.tsx`

```tsx
import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Modal({
  title,
  onClose,
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
```

`src/components/ConfirmDialog.tsx`

```tsx
import { Modal } from './Modal';

export function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
  busy,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Deleting...' : 'Delete'}
          </button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}
```

`src/components/Switch.tsx`

```tsx
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`switch${disabled ? ' disabled' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch-track" aria-hidden="true"><span className="switch-thumb" /></span>
      {label && <span className="switch-label">{label}</span>}
    </label>
  );
}
```

`src/components/Spinner.tsx`

```tsx
export function Spinner({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="spinner-wrap" role="status">
      <span className="spinner" />
      <span>{label}</span>
    </div>
  );
}
```

CSS classes used by the page (`btn`, `btn-primary`, `btn-ghost`, `btn-danger`, `btn-sm`, `btn-icon`, `card`, `badge`, `badge-on`, `badge-off`, `alert`, `alert-error`, `field`, `field-hint`, `nav-item`, `section-row`, `section-row.inactive`, `sections-list`, `order-btns`, `section-grip`, `section-main`, `section-type`, `section-cfg`, `toolbar`, `page-head`, `page-title`, `page-desc`, `empty`, `modal*`, `switch*`, `spinner*`) should be mapped to your panel's design system.

### 4.4 `src/pages/ScreensPage.tsx`

Adjust the import of `supabase` to your client path.

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Pencil,
  Copy,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical,
  MonitorSmartphone,
  Layers,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { WIDGETS, defaultConfigForWidget } from '../lib/widgetCatalog';
import {
  DEFAULT_GRID_CELLS,
  isDesktopPlatform,
  nextSectionPosition,
  normalizeGridCells,
  parseConfigJson,
  sectionsForPlatform,
  withoutLegacyGridCells,
  type SectionPlatform,
} from '../lib/screenSections';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Switch } from '../components/Switch';
import { Spinner } from '../components/Spinner';

type Screen = { id: string; slug: string; title: string; is_active: boolean };
type Section = {
  id: string;
  screen_id: string;
  position: number;
  type: string;
  config: unknown;
  is_active: boolean;
  is_desktop: boolean;
  grid_cells: number;
};
type SectionValues = Pick<Section, 'type' | 'config' | 'is_active' | 'is_desktop' | 'grid_cells'>;

function asObject(config: unknown): Record<string, unknown> {
  return config && typeof config === 'object' && !Array.isArray(config)
    ? (config as Record<string, unknown>)
    : {};
}

function sectionTitle(config: unknown): string | null {
  const title = asObject(config).title;
  return typeof title === 'string' && title.trim() ? title.trim() : null;
}

function isTitleHidden(config: unknown): boolean {
  return asObject(config).showTitle === false;
}

export function ScreensPage({ productId }: { productId: string | null }) {
  const [screens, setScreens] = useState<Screen[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionPlatform, setSectionPlatform] = useState<SectionPlatform>('mobile');
  const [loadingScreens, setLoadingScreens] = useState(true);
  const [loadingSections, setLoadingSections] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [screenModal, setScreenModal] = useState<{ record: Screen | null } | null>(null);
  const [sectionModal, setSectionModal] = useState<{ record: Section | null } | null>(null);
  const [deleteScreen, setDeleteScreen] = useState<Screen | null>(null);
  const [deleteSection, setDeleteSection] = useState<Section | null>(null);
  const [busy, setBusy] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [copyingToDesktopId, setCopyingToDesktopId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const loadScreens = useCallback(async () => {
    if (!productId) {
      setScreens([]);
      setSelectedId(null);
      setLoadingScreens(false);
      return;
    }
    setLoadingScreens(true);
    const { data, error } = await supabase
      .from('screens')
      .select('*')
      .eq('product_id', productId)
      .order('slug');
    if (error) setError(error.message);
    else {
      const list = (data as Screen[]) ?? [];
      setScreens(list);
      setSelectedId((prev) => (prev && list.some((s) => s.id === prev) ? prev : list[0]?.id ?? null));
    }
    setLoadingScreens(false);
  }, [productId]);

  const loadSections = useCallback(async (screenId: string) => {
    setLoadingSections(true);
    const { data, error } = await supabase
      .from('screen_sections')
      .select('*')
      .eq('screen_id', screenId)
      .order('position', { ascending: true });
    if (error) setError(error.message);
    else setSections((data as Section[]) ?? []);
    setLoadingSections(false);
  }, []);

  useEffect(() => {
    loadScreens();
  }, [loadScreens]);

  useEffect(() => {
    if (selectedId) loadSections(selectedId);
    else setSections([]);
  }, [selectedId, loadSections]);

  const selected = screens.find((s) => s.id === selectedId) ?? null;
  const visibleSections = useMemo(
    () => sectionsForPlatform(sections, sectionPlatform),
    [sections, sectionPlatform],
  );

  const saveScreen = async (values: { slug: string; title: string; is_active: boolean }) => {
    setBusy(true);
    setError(null);
    let err: string | null = null;
    let newId: string | null = null;
    if (screenModal?.record) {
      const { error } = await supabase.from('screens').update(values).eq('id', screenModal.record.id);
      err = error?.message ?? null;
    } else if (!productId) {
      err = 'Select a product before creating a screen.';
    } else {
      const { data, error } = await supabase
        .from('screens')
        .insert({ ...values, product_id: productId })
        .select('id')
        .maybeSingle();
      err = error?.message ?? null;
      newId = data?.id ?? null;
    }
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setScreenModal(null);
    await loadScreens();
    if (newId) setSelectedId(newId);
  };

  const confirmDeleteScreen = async () => {
    if (!deleteScreen) return;
    setBusy(true);
    const { error } = await supabase.from('screens').delete().eq('id', deleteScreen.id);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDeleteScreen(null);
    if (selectedId === deleteScreen.id) setSelectedId(null);
    await loadScreens();
  };

  const toggleScreen = async (screen: Screen) => {
    const next = !screen.is_active;
    setScreens((prev) => prev.map((s) => (s.id === screen.id ? { ...s, is_active: next } : s)));
    const { error } = await supabase.from('screens').update({ is_active: next }).eq('id', screen.id);
    if (error) {
      setError(error.message);
      loadScreens();
    }
  };

  const saveSection = async (values: SectionValues) => {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    let err: string | null = null;
    if (sectionModal?.record) {
      const platformChanged = sectionModal.record.is_desktop !== values.is_desktop;
      const updateValues = platformChanged
        ? { ...values, position: nextSectionPosition(sections, values.is_desktop) }
        : values;
      const { error } = await supabase
        .from('screen_sections')
        .update(updateValues)
        .eq('id', sectionModal.record.id);
      err = error?.message ?? null;
    } else {
      const { error } = await supabase
        .from('screen_sections')
        .insert({ ...values, screen_id: selectedId, position: nextSectionPosition(sections, values.is_desktop) });
      err = error?.message ?? null;
    }
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setSectionModal(null);
    await loadSections(selectedId);
  };

  const confirmDeleteSection = async () => {
    if (!deleteSection || !selectedId) return;
    setBusy(true);
    const { error } = await supabase.from('screen_sections').delete().eq('id', deleteSection.id);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDeleteSection(null);
    await loadSections(selectedId);
  };

  const toggleSection = async (section: Section) => {
    const next = !section.is_active;
    setSections((prev) => prev.map((s) => (s.id === section.id ? { ...s, is_active: next } : s)));
    const { error } = await supabase.from('screen_sections').update({ is_active: next }).eq('id', section.id);
    if (error && selectedId) {
      setError(error.message);
      loadSections(selectedId);
    }
  };

  const duplicateSection = async (section: Section, index: number) => {
    if (!selectedId || duplicatingId) return;
    setError(null);
    setDuplicatingId(section.id);

    const tempPos = nextSectionPosition(sections, section.is_desktop);
    const { data, error } = await supabase
      .from('screen_sections')
      .insert({
        screen_id: selectedId,
        type: section.type,
        config: section.config,
        position: tempPos,
        is_active: false,
        is_desktop: section.is_desktop,
        grid_cells: normalizeGridCells(section.grid_cells),
      })
      .select('id')
      .maybeSingle();
    if (error || !data) {
      setDuplicatingId(null);
      setError(error?.message ?? 'Could not duplicate the section.');
      return;
    }

    const copy: Section = { ...section, id: data.id, position: tempPos, is_active: false };
    const reordered = [...visibleSections];
    reordered.splice(index + 1, 0, copy);
    const withPos = reordered.map((s, i) => ({ ...s, position: i }));

    const stored = new Map(visibleSections.map((s) => [s.id, s.position]));
    stored.set(copy.id, tempPos);
    for (const s of withPos) {
      if (stored.get(s.id) === s.position) continue;
      const { error: e } = await supabase
        .from('screen_sections')
        .update({ position: s.position })
        .eq('id', s.id);
      if (e) {
        setError(e.message);
        break;
      }
    }

    setDuplicatingId(null);
    await loadSections(selectedId);
  };

  const copySectionToDesktop = async (section: Section) => {
    if (!selectedId || section.is_desktop || copyingToDesktopId || duplicatingId) return;
    setError(null);
    setCopyingToDesktopId(section.id);

    const { error } = await supabase
      .from('screen_sections')
      .insert({
        screen_id: selectedId,
        type: section.type,
        config: section.config,
        position: nextSectionPosition(sections, true),
        is_active: section.is_active,
        is_desktop: true,
        grid_cells: normalizeGridCells(section.grid_cells),
      });

    if (error) {
      setCopyingToDesktopId(null);
      setError(error.message);
      return;
    }
    await loadSections(selectedId);
    setCopyingToDesktopId(null);
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= visibleSections.length || !selectedId) return;
    const a = visibleSections[index];
    const b = visibleSections[target];
    const reordered = [...visibleSections];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const positions = new Map(reordered.map((s, i) => [s.id, i]));
    setSections((prev) => prev.map((s) => (
      positions.has(s.id) ? { ...s, position: positions.get(s.id)! } : s
    )));

    const { error: e1 } = await supabase.from('screen_sections').update({ position: b.position }).eq('id', a.id);
    const { error: e2 } = await supabase.from('screen_sections').update({ position: a.position }).eq('id', b.id);
    if (e1 || e2) setError((e1 ?? e2)?.message ?? 'Reorder failed');
    loadSections(selectedId);
  };

  const handleDrop = async (dropIndex: number) => {
    const from = dragIndex;
    setDragIndex(null);
    setOverIndex(null);
    if (from === null || from === dropIndex || !selectedId) return;
    const prev = visibleSections;
    const reordered = [...visibleSections];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(dropIndex, 0, moved);
    const withPos = reordered.map((s, i) => ({ ...s, position: i }));
    const positions = new Map(withPos.map((s) => [s.id, s.position]));
    setSections((current) => current.map((s) => (
      positions.has(s.id) ? { ...s, position: positions.get(s.id)! } : s
    )));
    const changed = withPos.filter((s, i) => prev.find((o) => o.id === s.id)?.position !== i);
    for (const s of changed) {
      const { error } = await supabase
        .from('screen_sections')
        .update({ position: s.position })
        .eq('id', s.id);
      if (error) {
        setError(error.message);
        break;
      }
    }
    loadSections(selectedId);
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">App Screens</h1>
          <p className="page-desc">
            Layouts served by the <code>screen-layout</code> function, ordered by position.
          </p>
        </div>
        {productId && (
          <button className="btn btn-primary" onClick={() => { setError(null); setScreenModal({ record: null }); }}>
            <Plus size={16} />
            New Screen
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {!productId ? (
        <div className="card empty">Select a product to manage its screens.</div>
      ) : loadingScreens ? (
        <Spinner label="Loading screens..." />
      ) : screens.length === 0 ? (
        <div className="card empty">
          <div className="empty-icon"><MonitorSmartphone size={40} /></div>
          No screens yet. Create one to start composing sections.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 260px) minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
          <div className="card" style={{ padding: 8 }}>
            {screens.map((s) => (
              <button
                key={s.id}
                className={`nav-item${s.id === selectedId ? ' active' : ''}`}
                style={{ width: '100%', justifyContent: 'space-between' }}
                onClick={() => setSelectedId(s.id)}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <Layers size={15} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.title || s.slug}
                  </span>
                </span>
                <span className={`badge ${s.is_active ? 'badge-on' : 'badge-off'}`}>{s.is_active ? 'On' : 'Off'}</span>
              </button>
            ))}
          </div>

          <div>
            {selected && (
              <>
                <div className="card" style={{ padding: '16px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{selected.title || selected.slug}</div>
                    <div style={{ fontSize: 12.5, fontFamily: 'monospace' }}>/{selected.slug}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Switch checked={selected.is_active} onChange={() => toggleScreen(selected)} label="Active" />
                    <button className="btn btn-ghost btn-sm" onClick={() => { setError(null); setScreenModal({ record: selected }); }}>
                      <Pencil size={14} /> Edit
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => setDeleteScreen(selected)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="toolbar" style={{ justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div role="group" aria-label="Section platform" style={{ display: 'flex', gap: 4 }}>
                      {(['mobile', 'desktop'] as const).map((platform) => (
                        <button
                          key={platform}
                          type="button"
                          className={`btn btn-sm ${sectionPlatform === platform ? 'btn-primary' : 'btn-ghost'}`}
                          aria-pressed={sectionPlatform === platform}
                          onClick={() => {
                            setSectionPlatform(platform);
                            setDragIndex(null);
                            setOverIndex(null);
                          }}
                        >
                          {platform === 'mobile' ? 'Mobile' : 'Desktop'}
                        </button>
                      ))}
                    </div>
                    <span style={{ fontSize: 13 }}>
                      {visibleSections.length} {visibleSections.length === 1 ? 'section' : 'sections'}
                    </span>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => { setError(null); setSectionModal({ record: null }); }}>
                    <Plus size={15} /> Add {sectionPlatform === 'desktop' ? 'Desktop' : 'Mobile'} Section
                  </button>
                </div>

                {loadingSections ? (
                  <Spinner />
                ) : visibleSections.length === 0 ? (
                  <div className="card empty">
                    No {sectionPlatform} sections yet. The app will use the{' '}
                    {sectionPlatform === 'desktop' ? 'Mobile' : 'Desktop'} layout for this screen.
                  </div>
                ) : (
                  <div className="sections-list">
                    {visibleSections.map((sec, i) => {
                      const title = sectionTitle(sec.config);
                      const hidden = isTitleHidden(sec.config);
                      return (
                        <div
                          key={sec.id}
                          className={`section-row${sec.is_active ? '' : ' inactive'}`}
                          draggable
                          onDragStart={(e) => { setDragIndex(i); e.dataTransfer.effectAllowed = 'move'; }}
                          onDragEnter={() => setOverIndex(i)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleDrop(i)}
                          onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
                          style={{
                            opacity: dragIndex === i ? 0.4 : undefined,
                            outline: overIndex === i && dragIndex !== null && dragIndex !== i ? '2px dashed currentColor' : undefined,
                            outlineOffset: -1,
                          }}
                        >
                          <div className="order-btns">
                            <button className="btn-icon" disabled={i === 0} onClick={() => move(i, -1)} title="Move up">
                              <ChevronUp size={16} />
                            </button>
                            <button className="btn-icon" disabled={i === visibleSections.length - 1} onClick={() => move(i, 1)} title="Move down">
                              <ChevronDown size={16} />
                            </button>
                          </div>
                          <div className="section-grip" style={{ cursor: 'grab' }} title="Drag to reorder"><GripVertical size={16} /></div>
                          <div className="section-main">
                            <div className="section-type">
                              <span style={{ opacity: 0.6, marginRight: 8 }}>{i + 1}.</span>
                              {sec.type || <span style={{ opacity: 0.6 }}>untyped</span>}
                              <span className="badge" style={{ marginLeft: 8 }}>
                                {sec.is_desktop ? 'Desktop' : 'Mobile'}
                              </span>
                              <span className="badge badge-off" style={{ marginLeft: 8 }}>
                                {normalizeGridCells(sec.grid_cells)} cells
                              </span>
                              {title && (
                                <span style={{
                                  fontWeight: 400,
                                  marginLeft: 8,
                                  ...(hidden ? { textDecoration: 'line-through', opacity: 0.55 } : {}),
                                }}>
                                  · {title}{hidden && ' (hidden)'}
                                </span>
                              )}
                            </div>
                            <div className="section-cfg">{JSON.stringify(sec.config)}</div>
                          </div>
                          <Switch checked={sec.is_active} onChange={() => toggleSection(sec)} />
                          {!sec.is_desktop && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={copyingToDesktopId !== null || duplicatingId !== null}
                              style={{ opacity: copyingToDesktopId === sec.id ? 0.5 : undefined }}
                              onClick={() => copySectionToDesktop(sec)}
                            >
                              Add to desktop version
                            </button>
                          )}
                          <button className="btn-icon" title="Edit" onClick={() => { setError(null); setSectionModal({ record: sec }); }}>
                            <Pencil size={15} />
                          </button>
                          <button
                            className="btn-icon"
                            title="Duplicate"
                            disabled={duplicatingId !== null || copyingToDesktopId !== null}
                            style={{ opacity: duplicatingId === sec.id ? 0.5 : undefined }}
                            onClick={() => duplicateSection(sec, i)}
                          >
                            <Copy size={15} />
                          </button>
                          <button className="btn-icon" title="Delete" onClick={() => setDeleteSection(sec)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {screenModal && (
        <ScreenModal
          record={screenModal.record}
          busy={busy}
          onCancel={() => setScreenModal(null)}
          onSubmit={saveScreen}
        />
      )}

      {sectionModal && (
        <SectionModal
          record={sectionModal.record}
          defaultIsDesktop={isDesktopPlatform(sectionPlatform)}
          busy={busy}
          onCancel={() => setSectionModal(null)}
          onSubmit={saveSection}
        />
      )}

      {deleteScreen && (
        <ConfirmDialog
          title="Delete screen?"
          message={`This removes "${deleteScreen.title || deleteScreen.slug}" and all of its sections. This cannot be undone.`}
          onConfirm={confirmDeleteScreen}
          onCancel={() => setDeleteScreen(null)}
          busy={busy}
        />
      )}
      {deleteSection && (
        <ConfirmDialog
          title="Delete section?"
          message="This removes the section from the screen. This cannot be undone."
          onConfirm={confirmDeleteSection}
          onCancel={() => setDeleteSection(null)}
          busy={busy}
        />
      )}
    </div>
  );
}

function ScreenModal({
  record,
  busy,
  onCancel,
  onSubmit,
}: {
  record: Screen | null;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (v: { slug: string; title: string; is_active: boolean }) => void;
}) {
  const [slug, setSlug] = useState(record?.slug ?? '');
  const [title, setTitle] = useState(record?.title ?? '');
  const [active, setActive] = useState(record?.is_active ?? true);
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    if (!slug.trim()) {
      setErr('Slug is required.');
      return;
    }
    onSubmit({ slug: slug.trim(), title: title.trim(), is_active: active });
  };

  return (
    <Modal
      title={record ? 'Edit Screen' : 'New Screen'}
      onClose={onCancel}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Saving...' : record ? 'Save changes' : 'Create'}
          </button>
        </>
      }
    >
      {err && <div className="alert alert-error">{err}</div>}
      <div className="field">
        <label htmlFor="slug">Slug *</label>
        <input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="home" />
        <div className="field-hint">Unique identifier the app requests, e.g. <code>home</code>.</div>
      </div>
      <div className="field">
        <label htmlFor="title">Title</label>
        <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Home" />
      </div>
      <div className="field">
        <Switch checked={active} onChange={setActive} label="Active (visible to the app)" />
      </div>
    </Modal>
  );
}

function SectionModal({
  record,
  defaultIsDesktop,
  busy,
  onCancel,
  onSubmit,
}: {
  record: Section | null;
  defaultIsDesktop: boolean;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (v: SectionValues) => void;
}) {
  const initialConfig = asObject(record?.config);
  const [type, setType] = useState(record?.type ?? '');
  const [config, setConfig] = useState(() => JSON.stringify(initialConfig, null, 2));
  const [active, setActive] = useState(record?.is_active ?? true);
  const [isDesktop, setIsDesktop] = useState(record?.is_desktop ?? defaultIsDesktop);
  const [gridCells, setGridCells] = useState(() => String(normalizeGridCells(
    record?.grid_cells ?? initialConfig.gridCells,
  )));
  const [err, setErr] = useState<string | null>(null);

  const widget = WIDGETS.find((candidate) => candidate.type === type);
  const parsedPreview = parseConfigJson(config).config;
  const showTitle = parsedPreview ? parsedPreview.showTitle !== false : true;

  const selectType = (nextType: string) => {
    const nextWidget = WIDGETS.find((candidate) => candidate.type === nextType);
    if (
      type !== '' &&
      nextType !== type &&
      !window.confirm('Changing section type will replace the current configuration. Continue?')
    ) {
      return;
    }
    setType(nextType);
    setConfig(JSON.stringify(nextWidget ? defaultConfigForWidget(nextWidget) : {}, null, 2));
    if (nextWidget?.desktopOnly) {
      setIsDesktop(true);
      setGridCells(String(DEFAULT_GRID_CELLS));
    }
    setErr(null);
  };

  const setShowTitle = (next: boolean) => {
    const parsed = parseConfigJson(config);
    if (!parsed.config) {
      setErr(parsed.error);
      return;
    }
    const updated = { ...parsed.config };
    if (next) delete updated.showTitle;
    else updated.showTitle = false;
    setConfig(JSON.stringify(updated, null, 2));
  };

  const submit = () => {
    if (!type.trim()) {
      setErr('Section type is required.');
      return;
    }
    const parsedGridCells = Number(gridCells);
    if (!Number.isInteger(parsedGridCells) || parsedGridCells < 1 || parsedGridCells > DEFAULT_GRID_CELLS) {
      setErr(`Grid cells must be a whole number from 1 to ${DEFAULT_GRID_CELLS}.`);
      return;
    }
    const parsed = parseConfigJson(config);
    if (!parsed.config) {
      setErr(parsed.error);
      return;
    }
    setErr(null);
    onSubmit({
      type: type.trim(),
      config: withoutLegacyGridCells(parsed.config),
      is_active: active,
      is_desktop: widget?.desktopOnly ? true : isDesktop,
      grid_cells: widget?.desktopOnly ? DEFAULT_GRID_CELLS : parsedGridCells,
    });
  };

  return (
    <Modal
      title={record ? 'Edit Section' : 'Add Section'}
      onClose={onCancel}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Saving...' : record ? 'Save changes' : 'Add'}
          </button>
        </>
      }
    >
      {err && <div className="alert alert-error">{err}</div>}
      <div className="field">
        <label htmlFor="type">Section type *</label>
        <select id="type" value={type} onChange={(e) => selectType(e.target.value)}>
          <option value="">Select a widget type</option>
          {type && !widget && <option value={type}>{type} (custom)</option>}
          {WIDGETS.map((w) => (
            <option key={w.type} value={w.type}>{w.label}</option>
          ))}
        </select>
        {widget && <div className="field-hint">{widget.description}</div>}
      </div>
      <div className="field">
        <label htmlFor="config">Config (JSON)</label>
        <textarea
          id="config"
          value={config}
          onChange={(e) => { setConfig(e.target.value); setErr(null); }}
          spellCheck={false}
          style={{ minHeight: 200, fontFamily: 'monospace' }}
        />
        <div className="field-hint">
          Top-level properties become widget props. Reserved keys: <code>key</code> (widget key),{' '}
          <code>data_binding</code> (<code>{'{ "source": "static", "items": [] }'}</code>),{' '}
          <code>showTitle</code>.
        </div>
      </div>
      <div className="field">
        <Switch checked={showTitle} onChange={setShowTitle} label="Show title" />
      </div>
      <div className="field">
        <Switch checked={active} onChange={setActive} label="Active (rendered by the app)" />
      </div>
      <div className="field">
        <label htmlFor="grid-cells">Grid cells</label>
        <input
          id="grid-cells"
          type="number"
          min={1}
          max={DEFAULT_GRID_CELLS}
          step={1}
          value={gridCells}
          disabled={widget?.desktopOnly}
          onChange={(e) => { setGridCells(e.target.value); setErr(null); }}
        />
        <div className="field-hint">Width in the 12-column layout (12 = full width).</div>
      </div>
      <div className="field">
        <Switch
          checked={isDesktop}
          onChange={setIsDesktop}
          disabled={widget?.desktopOnly}
          label="Desktop section"
        />
        <div className="field-hint">
          Moving a section to the other platform appends it at the end of that platform.
        </div>
      </div>
    </Modal>
  );
}
```

### 4.5 `tests/screenSections.test.ts` (Vitest)

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GRID_CELLS,
  nextSectionPosition,
  normalizeGridCells,
  parseConfigJson,
  sectionsForPlatform,
  withoutLegacyGridCells,
} from '../src/lib/screenSections';

const sections = [
  { id: 'm0', position: 0, is_desktop: false },
  { id: 'm1', position: 1, is_desktop: false },
  { id: 'd0', position: 0, is_desktop: true },
];

describe('screenSections', () => {
  it('filters sections by platform', () => {
    expect(sectionsForPlatform(sections, 'mobile').map((s) => s.id)).toEqual(['m0', 'm1']);
    expect(sectionsForPlatform(sections, 'desktop').map((s) => s.id)).toEqual(['d0']);
  });

  it('appends at the end of each platform independently', () => {
    expect(nextSectionPosition(sections, false)).toBe(2);
    expect(nextSectionPosition(sections, true)).toBe(1);
    expect(nextSectionPosition([], true)).toBe(0);
  });

  it('normalizes grid cells to 1..12', () => {
    expect(normalizeGridCells(6)).toBe(6);
    expect(normalizeGridCells(1)).toBe(1);
    expect(normalizeGridCells(12)).toBe(12);
    expect(normalizeGridCells(0)).toBe(DEFAULT_GRID_CELLS);
    expect(normalizeGridCells(13)).toBe(DEFAULT_GRID_CELLS);
    expect(normalizeGridCells(4.5)).toBe(DEFAULT_GRID_CELLS);
    expect(normalizeGridCells('6')).toBe(DEFAULT_GRID_CELLS);
    expect(normalizeGridCells(undefined)).toBe(DEFAULT_GRID_CELLS);
  });

  it('strips legacy gridCells from config', () => {
    expect(withoutLegacyGridCells({ title: 'A', gridCells: 4 })).toEqual({ title: 'A' });
  });

  it('parses config JSON objects only', () => {
    expect(parseConfigJson('').config).toEqual({});
    expect(parseConfigJson('{"a":1}').config).toEqual({ a: 1 });
    expect(parseConfigJson('[1]').error).toBe('Config must be a JSON object.');
    expect(parseConfigJson('{').error).toBe('Config must be valid JSON.');
  });
});
```

Optional server-side test for the fallback (Deno):

```ts
import { assertEquals } from "jsr:@std/assert";
import { selectSectionsForPlatform } from "../_shared/screen-platform.ts";

Deno.test("falls back to the other platform", () => {
  const mobileOnly = [{ id: "m", is_desktop: false }];
  const desktopOnly = [{ id: "d", is_desktop: true }];
  const both = [...mobileOnly, ...desktopOnly];
  assertEquals(selectSectionsForPlatform(mobileOnly, "desktop").map((s) => s.id), ["m"]);
  assertEquals(selectSectionsForPlatform(desktopOnly, "mobile").map((s) => s.id), ["d"]);
  assertEquals(selectSectionsForPlatform(both, "desktop").map((s) => s.id), ["d"]);
  assertEquals(selectSectionsForPlatform(both, "mobile").map((s) => s.id), ["m"]);
});
```

---

## 5. Installation and verification

### 5.1 Steps

1. **Database**: adapt `products` and `is_admin()` in section 2, then apply the migration. Optionally run the sample data.
2. **Edge Function**: add the four files from section 3 and the `config.toml` entry, then deploy `screen-layout`.
3. **BO page**: add the files from section 4, map the CSS classes to your design system, and adjust the Supabase client import.
4. **Navigation**: add an "App Screens" entry to the BO menu that renders `<ScreensPage productId={currentProductId} />`, visible to admins only.
5. **App**: call `GET /functions/v1/screen-layout?product_id=<uuid>&screen=<slug>&platform=<mobile|desktop>` with the anon key in the `Authorization` and `apikey` headers, and render `widgets` in order inside a 12-column grid using `gridCells`.

### 5.2 Checklist

- [ ] A non-admin user cannot create, edit or delete screens or sections.
- [ ] Creating a screen with a duplicate slug for the same product is rejected.
- [ ] New sections are appended at the end of the selected platform.
- [ ] Drag-and-drop and up/down arrows change the order; the function returns the new order.
- [ ] Mobile and Desktop tabs show independent lists and independent ordering.
- [ ] "Add to desktop version" creates a Desktop copy at the end of the Desktop list, keeping config and grid cells.
- [ ] Duplicating a section inserts an inactive copy right below the original.
- [ ] Moving a section to the other platform via the Desktop switch appends it there.
- [ ] Grid cells outside 1–12 cannot be saved from the BO and are rejected by the database.
- [ ] The function returns `gridCells` for every widget (12 when not set).
- [ ] Screen with Mobile sections only: `platform=desktop` returns the Mobile sections.
- [ ] Screen with Desktop sections only: `platform=mobile` returns the Desktop sections.
- [ ] Screen with both: each platform returns its own sections.
- [ ] Inactive sections are not returned; an inactive screen returns `404`.
- [ ] "Show title" off saves `showTitle: false`; the list shows the title struck through with "(hidden)" and the app hides it.
- [ ] Deleting a screen also deletes all its sections.
