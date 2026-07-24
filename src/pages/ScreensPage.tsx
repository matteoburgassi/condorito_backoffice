import { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical,
  MonitorSmartphone,
  Layers,
} from 'lucide-react';
import {
  BANNER_PRESETS,
  WIDGETS,
  defaultConfigForWidget,
} from '../lib/widgetCatalog';
import {
  asWidgetConfig,
  normalizeTranslations,
  parseWidgetConfigJson,
  stringifyWidgetConfig,
  validateWidgetConfig,
} from '../lib/widgetSchema';
import { supabase } from '../lib/supabase';
import { useProduct } from '../lib/ProductContext';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Switch } from '../components/Switch';
import { Spinner } from '../components/Spinner';
import {
  WidgetSchemaForm,
  WidgetTranslationFields,
} from '../components/WidgetSchemaForm';

type Screen = { id: string; slug: string; title: string; is_active: boolean };
type Section = {
  id: string;
  screen_id: string;
  position: number;
  type: string;
  config: unknown;
  is_active: boolean;
};

export function ScreensPage() {
  const { productId, current } = useProduct();
  const [screens, setScreens] = useState<Screen[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [loadingScreens, setLoadingScreens] = useState(true);
  const [loadingSections, setLoadingSections] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [screenModal, setScreenModal] = useState<{ record: Screen | null } | null>(null);
  const [sectionModal, setSectionModal] = useState<{ record: Section | null } | null>(null);
  const [deleteScreen, setDeleteScreen] = useState<Screen | null>(null);
  const [deleteSection, setDeleteSection] = useState<Section | null>(null);
  const [busy, setBusy] = useState(false);
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
      .from('product_screens')
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
      .from('product_screen_sections')
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

  const saveScreen = async (values: { slug: string; title: string; is_active: boolean }) => {
    setBusy(true);
    setError(null);
    let err: string | null = null;
    let newId: string | null = null;
    if (screenModal?.record) {
      const { error } = await supabase.from('product_screens').update(values).eq('id', screenModal.record.id);
      err = error?.message ?? null;
    } else if (!productId) {
      err = 'Select a product before creating a screen.';
    } else {
      const { data, error } = await supabase
        .from('product_screens')
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
    const { error } = await supabase.from('product_screens').delete().eq('id', deleteScreen.id);
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
    const { error } = await supabase.from('product_screens').update({ is_active: next }).eq('id', screen.id);
    if (error) {
      setError(error.message);
      loadScreens();
    }
  };

  const saveSection = async (values: { type: string; config: unknown; is_active: boolean }) => {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    let err: string | null = null;
    if (sectionModal?.record) {
      const { error } = await supabase
        .from('product_screen_sections')
        .update(values)
        .eq('id', sectionModal.record.id);
      err = error?.message ?? null;
    } else {
      const nextPos = sections.reduce((m, s) => Math.max(m, s.position), -1) + 1;
      const { error } = await supabase
        .from('product_screen_sections')
        .insert({ ...values, screen_id: selectedId, position: nextPos });
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
    const { error } = await supabase.from('product_screen_sections').delete().eq('id', deleteSection.id);
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
    const { error } = await supabase.from('product_screen_sections').update({ is_active: next }).eq('id', section.id);
    if (error && selectedId) {
      setError(error.message);
      loadSections(selectedId);
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= sections.length || !selectedId) return;
    const a = sections[index];
    const b = sections[target];
    const reordered = [...sections];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setSections(reordered.map((s, i) => ({ ...s, position: i })));

    const { error: e1 } = await supabase.from('product_screen_sections').update({ position: b.position }).eq('id', a.id);
    const { error: e2 } = await supabase.from('product_screen_sections').update({ position: a.position }).eq('id', b.id);
    if (e1 || e2) {
      setError((e1 ?? e2)?.message ?? 'Reorder failed');
    }
    loadSections(selectedId);
  };

  const handleDrop = async (dropIndex: number) => {
    const from = dragIndex;
    setDragIndex(null);
    setOverIndex(null);
    if (from === null || from === dropIndex || !selectedId) return;
    const prev = sections;
    const reordered = [...sections];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(dropIndex, 0, moved);
    const withPos = reordered.map((s, i) => ({ ...s, position: i }));
    setSections(withPos);
    const changed = withPos.filter((s, i) => prev.find((o) => o.id === s.id)?.position !== i);
    for (const s of changed) {
      const { error } = await supabase
        .from('product_screen_sections')
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
            Data-driven layouts rendered by the <code>condorito-screen</code> function, ordered by position.
            {current ? ` · ${current.display_name}` : ''}
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
                    <div className="cell-mono" style={{ fontSize: 12.5 }}>/{selected.slug}</div>
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
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {sections.length} {sections.length === 1 ? 'section' : 'sections'}
                  </span>
                  <button className="btn btn-primary btn-sm" onClick={() => { setError(null); setSectionModal({ record: null }); }}>
                    <Plus size={15} /> Add Section
                  </button>
                </div>

                {loadingSections ? (
                  <Spinner />
                ) : sections.length === 0 ? (
                  <div className="card empty">No sections yet. Add one to compose this screen.</div>
                ) : (
                  <div className="sections-list">
                    {sections.map((sec, i) => (
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
                          outline: overIndex === i && dragIndex !== null && dragIndex !== i ? '2px dashed var(--primary)' : undefined,
                          outlineOffset: -1,
                        }}
                      >
                        <div className="order-btns">
                          <button className="btn-icon" disabled={i === 0} onClick={() => move(i, -1)} title="Move up">
                            <ChevronUp size={16} />
                          </button>
                          <button className="btn-icon" disabled={i === sections.length - 1} onClick={() => move(i, 1)} title="Move down">
                            <ChevronDown size={16} />
                          </button>
                        </div>
                        <div className="section-grip" style={{ cursor: 'grab' }} title="Drag to reorder"><GripVertical size={16} /></div>
                        <div className="section-main">
                          <div className="section-type">
                            <span style={{ color: 'var(--text-faint)', marginRight: 8 }}>{i + 1}.</span>
                            {sec.type || <span style={{ color: 'var(--text-faint)' }}>untyped</span>}
                          </div>
                          <div className="section-cfg">{JSON.stringify(sec.config)}</div>
                        </div>
                        <Switch checked={sec.is_active} onChange={() => toggleSection(sec)} />
                        <button className="btn-icon" title="Edit" onClick={() => { setError(null); setSectionModal({ record: sec }); }}>
                          <Pencil size={15} />
                        </button>
                        <button className="btn-icon" title="Delete" onClick={() => setDeleteSection(sec)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
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
        <label htmlFor="slug">Slug <span style={{ color: 'var(--primary)' }}>*</span></label>
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
  busy,
  onCancel,
  onSubmit,
}: {
  record: Section | null;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (v: { type: string; config: unknown; is_active: boolean }) => void;
}) {
  const initialType = record?.type ?? '';
  const initialConfig = record?.config ?? {};
  const [type, setType] = useState(initialType);
  const [configValue, setConfigValue] = useState(() => asWidgetConfig(initialConfig));
  const [config, setConfig] = useState(() => stringifyWidgetConfig(initialConfig));
  const [advancedJson, setAdvancedJson] = useState(false);
  const [active, setActive] = useState(record?.is_active ?? true);
  const [err, setErr] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const widget = WIDGETS.find((candidate) => candidate.type === type);
  const schema = widget?.schema;

  const replaceConfiguration = (
    nextType: string,
    nextConfig: Record<string, unknown>,
  ) => {
    const hasUnsavedConfiguration =
      type !== initialType ||
      JSON.stringify(configValue) !== JSON.stringify(asWidgetConfig(initialConfig)) ||
      (advancedJson && config !== stringifyWidgetConfig(initialConfig));

    if (
      nextType !== type &&
      type !== '' &&
      hasUnsavedConfiguration &&
      !window.confirm('Changing section type will replace the current configuration. Continue?')
    ) {
      return;
    }

    setType(nextType);
    setConfigValue(nextConfig);
    setConfig(stringifyWidgetConfig(nextConfig));
    setAdvancedJson(false);
    setFieldErrors({});
    setErr(null);
  };

  const selectType = (nextType: string) => {
    const nextWidget = WIDGETS.find((candidate) => candidate.type === nextType);
    replaceConfiguration(
      nextType,
      nextWidget ? defaultConfigForWidget(nextWidget) : {},
    );
  };

  const applyPreset = (presetKey: string) => {
    const preset = BANNER_PRESETS[presetKey];
    if (!preset) return;
    replaceConfiguration(preset.type, preset.config);
  };

  const loadWidgetExample = (widgetType: string) => {
    const doc = WIDGETS.find((w) => w.type === widgetType);
    if (!doc) return;
    replaceConfiguration(doc.type, defaultConfigForWidget(doc));
  };

  const parseObjectConfig = () => {
    const parsed = parseWidgetConfigJson(config);
    if (parsed.error) {
      setErr(parsed.error);
      return null;
    }
    return parsed.config;
  };

  const toggleAdvancedJson = () => {
    if (!advancedJson) {
      setConfig(stringifyWidgetConfig(configValue));
      setAdvancedJson(true);
      setErr(null);
      return;
    }

    const parsed = parseObjectConfig();
    if (!parsed) return;
    setConfigValue(parsed);
    setAdvancedJson(false);
    setErr(null);
  };

  const submit = () => {
    if (!type.trim()) {
      setErr('Section type is required.');
      return;
    }
    let parsed: unknown = configValue;

    if (!schema || advancedJson) {
      try {
        parsed = config.trim() === '' ? {} : JSON.parse(config);
      } catch {
        setErr('Config must be valid JSON.');
        return;
      }
    }

    if (schema) {
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setErr('Config must be a JSON object.');
        return;
      }
      const normalized = normalizeTranslations(parsed as Record<string, unknown>);
      const validationErrors = validateWidgetConfig(schema, normalized);
      setFieldErrors(validationErrors);
      if (Object.keys(validationErrors).length > 0) {
        setErr('Fix the highlighted configuration fields before saving.');
        if (advancedJson) setConfig(stringifyWidgetConfig(normalized));
        return;
      }
      parsed = normalized;
    }

    setErr(null);
    onSubmit({ type: type.trim(), config: parsed, is_active: active });
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
      {!record && (
        <div className="field">
          <label>Section presets</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(BANNER_PRESETS).map(([key, preset]) => (
              <button key={key} type="button" className="btn btn-ghost btn-sm" onClick={() => applyPreset(key)}>
                {preset.label}
              </button>
            ))}
          </div>
          <div className="field-hint">
            Ready-made sections: Area Libre, Subscribe, Continua Leyendo (includes{' '}
            <code>audience</code> / <code>variant</code>).
          </div>
        </div>
      )}
      <div className="field">
        <label htmlFor="type">Section type <span style={{ color: 'var(--primary)' }}>*</span></label>
        <select
          id="type"
          value={type}
          onChange={(e) => selectType(e.target.value)}
        >
          <option value="">Select a widget type</option>
          {type && !WIDGETS.some((candidate) => candidate.type === type) && (
            <option value={type}>{type} (custom)</option>
          )}
          {WIDGETS.map((w) => (
            <option key={w.type} value={w.type}>{w.label}</option>
          ))}
        </select>
        <div className="field-hint" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {WIDGETS.slice(0, 6).map((w) => (
            <button key={w.type} type="button" className="btn btn-ghost btn-sm" onClick={() => loadWidgetExample(w.type)}>
              {w.label}
            </button>
          ))}
        </div>
      </div>
      {schema && !advancedJson ? (
        <>
          <WidgetSchemaForm
            schema={schema}
            value={configValue}
            onChange={(next) => {
              setConfigValue(next);
              setFieldErrors({});
              setErr(null);
            }}
            errors={fieldErrors}
          />
          <WidgetTranslationFields
            schema={schema}
            value={configValue}
            onChange={(next) => {
              setConfigValue(next);
              setErr(null);
            }}
          />
        </>
      ) : (
        <div className="field">
          <label htmlFor="config">Config (JSON)</label>
          <textarea
            id="config"
            value={config}
            onChange={(e) => {
              setConfig(e.target.value);
              setErr(null);
            }}
            spellCheck={false}
            style={{ minHeight: 200 }}
          />
          <div className="field-hint">
            Top-level props become widget fields. Reserved keys: <code>i18n</code>, <code>data_binding</code>, and{' '}
            <code>audience</code> (<code>guest</code>, <code>logged_in</code>, <code>non_premium</code>, or{' '}
            <code>all</code>). The app filters by auth/subscription client-side.
          </div>
        </div>
      )}
      {schema && (
        <div className="field">
          <button type="button" className="btn btn-ghost btn-sm" onClick={toggleAdvancedJson}>
            {advancedJson ? 'Back to generated form' : 'Advanced JSON'}
          </button>
          <div className="field-hint">
            Advanced JSON preserves custom fields that are not represented by this prototype form.
          </div>
        </div>
      )}
      <div className="field">
        <Switch checked={active} onChange={setActive} label="Active (rendered by the app)" />
      </div>
    </Modal>
  );
}
