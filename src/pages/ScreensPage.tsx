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
import {
  BANNER_PRESETS,
  WIDGETS,
  defaultConfigForWidget,
  widgetEditorMode,
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
import {
  DEFAULT_GRID_CELLS,
  isDesktopPlatform,
  nextSectionPosition,
  normalizeGridCells,
  sectionsForPlatform,
  withoutLegacyGridCells,
  type SectionPlatform,
} from '../lib/screenSections';
import {
  AREA_LIBRE_COMPOSITION_TYPE,
  validateAreaLibreCompositionReferences,
} from '../lib/areaLibreComposition';
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
  is_desktop: boolean;
  grid_cells: number;
};
type SectionValues = Pick<Section, 'type' | 'config' | 'is_active' | 'is_desktop' | 'grid_cells'>;

function sectionTitle(config: unknown): string | null {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
  const title = (config as Record<string, unknown>).title;
  return typeof title === 'string' && title.trim() ? title.trim() : null;
}

function sectionTitleKey(config: unknown): string | null {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
  const i18n = (config as Record<string, unknown>).i18n;
  if (!i18n || typeof i18n !== 'object' || Array.isArray(i18n)) return null;
  const key = (i18n as Record<string, unknown>).title;
  return typeof key === 'string' && key.trim() ? key.trim() : null;
}

function isTitleHidden(config: unknown): boolean {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return false;
  return (config as Record<string, unknown>).showTitle === false;
}

export function ScreensPage() {
  const { productId, current } = useProduct();
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
  const [i18nTitles, setI18nTitles] = useState<Record<string, string>>({});
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

  useEffect(() => {
    const fullKeys = Array.from(new Set(
      sections.map((s) => sectionTitleKey(s.config)).filter((k): k is string => k !== null),
    ));
    if (fullKeys.length === 0 || !productId) {
      setI18nTitles({});
      return;
    }
    let cancelled = false;
    (async () => {
      const bareKeys = fullKeys.map((k) => (k.includes('.') ? k.slice(k.indexOf('.') + 1) : k));
      const [langsRes, rowsRes] = await Promise.all([
        supabase
          .from('product_languages')
          .select('code, is_default')
          .eq('product_id', productId),
        supabase
          .from('product_translations')
          .select('language_code, namespace, key, value')
          .eq('product_id', productId)
          .in('key', Array.from(new Set([...bareKeys, ...fullKeys]))),
      ]);
      if (cancelled || rowsRes.error || !rowsRes.data) return;
      const langs = langsRes.data ?? [];
      const defaultLang = langs.find((l) => l.is_default)?.code ?? langs[0]?.code ?? null;
      const rows = rowsRes.data as Array<{ language_code: string; namespace: string; key: string; value: string }>;

      const map: Record<string, string> = {};
      for (const full of fullKeys) {
        const dot = full.indexOf('.');
        const ns = dot > 0 ? full.slice(0, dot) : null;
        const bare = dot > 0 ? full.slice(dot + 1) : full;
        let candidates = ns ? rows.filter((r) => r.namespace === ns && r.key === bare) : [];
        if (candidates.length === 0) candidates = rows.filter((r) => r.key === full);
        if (candidates.length === 0) candidates = rows.filter((r) => r.key === bare);
        const match = candidates.find((r) => r.language_code === defaultLang) ?? candidates[0];
        if (match && typeof match.value === 'string' && match.value.trim()) map[full] = match.value.trim();
      }
      setI18nTitles(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [sections, productId]);

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
        .from('product_screen_sections')
        .update(updateValues)
        .eq('id', sectionModal.record.id);
      err = error?.message ?? null;
    } else {
      const nextPos = nextSectionPosition(sections, values.is_desktop);
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
    if (
      next
      && section.type === AREA_LIBRE_COMPOSITION_TYPE
      && (
        selected?.slug !== 'freemium'
        || !section.is_desktop
        || sections.some((candidate) => (
          candidate.id !== section.id
          && candidate.type === AREA_LIBRE_COMPOSITION_TYPE
          && candidate.is_active
          && candidate.is_desktop
        ))
      )
    ) {
      setError(
        selected?.slug !== 'freemium' || !section.is_desktop
          ? 'Area Libre composition can be activated only on the freemium desktop layout.'
          : 'Only one active Area Libre composition is allowed.',
      );
      return;
    }
    setSections((prev) => prev.map((s) => (s.id === section.id ? { ...s, is_active: next } : s)));
    const { error } = await supabase.from('product_screen_sections').update({ is_active: next }).eq('id', section.id);
    if (error && selectedId) {
      setError(error.message);
      loadSections(selectedId);
    }
  };

  const duplicateSection = async (section: Section, index: number) => {
    if (!selectedId || duplicatingId) return;
    setError(null);
    setDuplicatingId(section.id);

    const tempPos = sections.reduce((m, s) => Math.max(m, s.position), -1) + 1;
    const { data, error } = await supabase
      .from('product_screen_sections')
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
        .from('product_screen_sections')
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
      .from('product_screen_sections')
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
    const movedSections = reordered.map((s, i) => ({ ...s, position: i }));
    const positions = new Map(movedSections.map((s) => [s.id, s.position]));
    setSections((prev) => prev.map((s) => (
      positions.has(s.id) ? { ...s, position: positions.get(s.id)! } : s
    )));

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
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
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
                    No {sectionPlatform} sections yet. Add one to compose this layout.
                  </div>
                ) : (
                  <div className="sections-list">
                    {visibleSections.map((sec, i) => (
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
                          <button className="btn-icon" disabled={i === visibleSections.length - 1} onClick={() => move(i, 1)} title="Move down">
                            <ChevronDown size={16} />
                          </button>
                        </div>
                        <div className="section-grip" style={{ cursor: 'grab' }} title="Drag to reorder"><GripVertical size={16} /></div>
                        <div className="section-main">
                          <div className="section-type">
                            <span className="section-title-content">
                              <span style={{ color: 'var(--text-faint)', marginRight: 8 }}>{i + 1}.</span>
                              {sec.type || <span style={{ color: 'var(--text-faint)' }}>untyped</span>}
                              <span className="badge" style={{ marginLeft: 8 }}>
                                {sec.is_desktop ? 'Desktop' : 'Mobile'}
                              </span>
                              {(() => {
                                const key = sectionTitleKey(sec.config);
                                const display = (key && i18nTitles[key]) || sectionTitle(sec.config);
                                const hidden = isTitleHidden(sec.config);
                                return display ? (
                                  <span style={{
                                    color: 'var(--text-muted)',
                                    fontWeight: 400,
                                    marginLeft: 8,
                                    ...(hidden ? { textDecoration: 'line-through', opacity: 0.55 } : {}),
                                  }}>
                                    · {display}{hidden && ' (hidden)'}
                                  </span>
                                ) : null;
                              })()}
                            </span>
                            {sectionPlatform === 'desktop' && (
                              <span className="badge badge-off section-grid-cells">
                                {normalizeGridCells(sec.grid_cells)} cells
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
                            add to desktop version
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
          defaultIsDesktop={isDesktopPlatform(sectionPlatform)}
          screenSlug={selected?.slug ?? ''}
          sections={sections}
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
  defaultIsDesktop,
  screenSlug,
  sections,
  busy,
  onCancel,
  onSubmit,
}: {
  record: Section | null;
  defaultIsDesktop: boolean;
  screenSlug: string;
  sections: Section[];
  busy: boolean;
  onCancel: () => void;
  onSubmit: (v: SectionValues) => void;
}) {
  const initialType = record?.type ?? '';
  const initialConfig = record?.config ?? {};
  const [type, setType] = useState(initialType);
  const [configValue, setConfigValue] = useState(() => asWidgetConfig(initialConfig));
  const [config, setConfig] = useState(() => stringifyWidgetConfig(initialConfig));
  const [advancedJson, setAdvancedJson] = useState(false);
  const [active, setActive] = useState(record?.is_active ?? true);
  const [isDesktop, setIsDesktop] = useState(
    initialType === AREA_LIBRE_COMPOSITION_TYPE
      ? true
      : record?.is_desktop ?? defaultIsDesktop,
  );
  const [gridCells, setGridCells] = useState(() => String(normalizeGridCells(
    initialType === AREA_LIBRE_COMPOSITION_TYPE
      ? DEFAULT_GRID_CELLS
      : record?.grid_cells ?? asWidgetConfig(initialConfig).gridCells,
  )));
  const [err, setErr] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const widget = WIDGETS.find((candidate) => candidate.type === type);
  const availableWidgets = WIDGETS.filter((candidate) => (
    !candidate.allowedScreenSlugs || candidate.allowedScreenSlugs.includes(screenSlug)
  ));
  const schema = widget?.schema;
  const runtimeManaged = widgetEditorMode(widget) === 'runtime-managed';

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
    if (nextWidget?.desktopOnly) {
      setIsDesktop(true);
      setGridCells(String(DEFAULT_GRID_CELLS));
    }
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
    const parsedGridCells = Number(gridCells);
    if (
      !Number.isInteger(parsedGridCells) ||
      parsedGridCells < 1 ||
      parsedGridCells > DEFAULT_GRID_CELLS
    ) {
      setErr(`Desktop grid cells must be a whole number from 1 to ${DEFAULT_GRID_CELLS}.`);
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
      if (type === AREA_LIBRE_COMPOSITION_TYPE) {
        Object.assign(validationErrors, validateAreaLibreCompositionReferences(normalized, {
          screenSlug,
          sections,
          currentSectionId: record?.id,
          isActive: active,
          isDesktop,
        }));
      }
      setFieldErrors(validationErrors);
      if (Object.keys(validationErrors).length > 0) {
        setErr(
          type === AREA_LIBRE_COMPOSITION_TYPE
            ? Array.from(new Set(Object.values(validationErrors))).join(' ')
            : 'Fix the highlighted configuration fields before saving.',
        );
        if (advancedJson) setConfig(stringifyWidgetConfig(normalized));
        return;
      }
      parsed = normalized;
    }

    parsed = withoutLegacyGridCells(parsed);
    setErr(null);
    onSubmit({
      type: type.trim(),
      config: parsed,
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
          {availableWidgets.map((w) => (
            <option key={w.type} value={w.type}>{w.label}</option>
          ))}
        </select>
        <div className="field-hint" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {availableWidgets.slice(0, 6).map((w) => (
            <button key={w.type} type="button" className="btn btn-ghost btn-sm" onClick={() => loadWidgetExample(w.type)}>
              {w.label}
            </button>
          ))}
        </div>
      </div>
      {runtimeManaged ? (
        <div className="field">
          <label>Runtime-managed configuration</label>
          <div className="alert">
            Footer links, copyright, translations, and the widget key are injected by
            <code> condorito-screen</code>. Only this section&apos;s order, active state,
            platform, and desktop width can be changed in the Back Office. Existing stored
            configuration is preserved on save.
          </div>
        </div>
      ) : schema && !advancedJson ? (
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
      <div className="field">
        <label htmlFor="grid-cells">Desktop grid cells</label>
        <input
          id="grid-cells"
          type="number"
          min={1}
          max={DEFAULT_GRID_CELLS}
          step={1}
          value={gridCells}
          disabled={widget?.desktopOnly}
          onChange={(event) => {
            setGridCells(event.target.value);
            setErr(null);
          }}
        />
        <div className="field-hint">
          Width in the desktop 12-column layout. Mobile always uses 12 cells.
        </div>
      </div>
      <div className="field">
        <Switch
          checked={isDesktop}
          onChange={setIsDesktop}
          disabled={widget?.desktopOnly}
          label="Is rendered in desktop version only"
        />
      </div>
    </Modal>
  );
}
