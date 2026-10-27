import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, FileText, Inbox, RefreshCw } from 'lucide-react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useProduct, type LegalDocumentsSource } from '../lib/ProductContext';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Spinner } from '../components/Spinner';
import { HtmlBodyEditor } from '../components/HtmlBodyEditor';
import { isDesktopPlatform, type SectionPlatform } from '../lib/screenSections';

type DocumentRow = {
  id: string;
  slug: string;
  path: string;
  title: string;
  version: number;
  updated_at: string;
  is_atom: boolean;
};

type DocumentValues = { slug: string; path: string; title: string; version: number; is_atom: boolean };

type AtomDiscoveryResponse = {
  formatsDiscovered: string[];
};

type ContentRow = {
  id: string;
  document_id: string;
  locale: string;
  title: string;
  body_html: string;
  is_desktop: boolean;
};

type ContentValues = {
  locale: string;
  title: string;
  body_html: string;
  is_desktop: boolean;
};

const ATOM_FUNCTION = 'get-atom-legal-document';
const ATOM_DEFAULT_LOCALE = 'fr';

async function invokeAtom<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(ATOM_FUNCTION, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null);
      throw new Error(payload?.error ?? error.message);
    }
    throw new Error(error.message);
  }
  if (!data?.ok) throw new Error(data?.error ?? 'ATOM request failed');
  return data as T;
}

function useAtomProductId(productId: string | null) {
  const [atomProductId, setAtomProductId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) {
      setAtomProductId(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('product_config')
        .select('value')
        .eq('product_id', productId)
        .eq('key', 'ATOM_PRODUCT_ID')
        .maybeSingle();
      if (!active) return;
      setError(error?.message ?? null);
      setAtomProductId(data?.value?.trim() || null);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [productId]);

  return { atomProductId, loading, error };
}

export function DocumentsPage() {
  const { productId, current, setLegalDocumentsSource } = useProduct();
  const source: LegalDocumentsSource = current?.legal_documents_source ?? 'CUSTOM';
  const isAtomView = source === 'ATOM';
  const atom = useAtomProductId(productId);
  const [savingSource, setSavingSource] = useState(false);
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [translationValues, setTranslationValues] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contents, setContents] = useState<ContentRow[]>([]);
  const [contentPlatform, setContentPlatform] = useState<SectionPlatform>('mobile');
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadingContents, setLoadingContents] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [docModal, setDocModal] = useState<{ record: DocumentRow | null } | null>(null);
  const [contentModal, setContentModal] = useState<{ record: ContentRow | null } | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<DocumentRow | null>(null);
  const [deleteContent, setDeleteContent] = useState<ContentRow | null>(null);
  const [copyingToDesktopId, setCopyingToDesktopId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadDocs = useCallback(async () => {
    if (!productId) {
      setDocs([]);
      setSelectedId(null);
      setLoadingDocs(false);
      return;
    }
    setLoadingDocs(true);
    const [{ data, error }, { data: defaultLanguage }] = await Promise.all([
      supabase
        .from('product_documents')
        .select('*')
        .eq('product_id', productId)
        .eq('is_atom', isAtomView)
        .order('slug'),
      supabase
        .from('product_languages')
        .select('code')
        .eq('product_id', productId)
        .eq('is_default', true)
        .maybeSingle(),
    ]);
    if (error) {
      setError(error.message);
    } else {
      const list = (data as DocumentRow[]) ?? [];
      setDocs(list);
      setSelectedId((prev) => (prev && list.some((d) => d.id === prev) ? prev : list[0]?.id ?? null));

      const languageCode = defaultLanguage?.code ?? 'es';
      const { data: translations, error: translationsError } = await supabase
        .from('product_translations')
        .select('namespace, key, value')
        .eq('product_id', productId)
        .eq('language_code', languageCode);
      if (translationsError) {
        setError(translationsError.message);
      } else {
        setTranslationValues(
          Object.fromEntries(
            (translations ?? []).map((translation) => [
              `${translation.namespace}.${translation.key}`,
              translation.value,
            ]),
          ),
        );
      }
    }
    setLoadingDocs(false);
  }, [productId, isAtomView]);

  const loadContents = useCallback(async (documentId: string) => {
    setLoadingContents(true);
    const { data, error } = await supabase
      .from('product_document_content')
      .select('*')
      .eq('document_id', documentId)
      .order('locale');
    if (error) setError(error.message);
    else setContents((data as ContentRow[]) ?? []);
    setLoadingContents(false);
  }, []);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  useEffect(() => {
    if (selectedId && !isAtomView) loadContents(selectedId);
    else setContents([]);
  }, [selectedId, isAtomView, loadContents]);

  const selected = docs.find((d) => d.id === selectedId) ?? null;
  const documentDisplayTitle = useCallback(
    (document: DocumentRow) => translationValues[document.title] || document.title,
    [translationValues],
  );
  const isDesktop = isDesktopPlatform(contentPlatform);
  const visibleContents = useMemo(
    () => contents.filter((c) => c.is_desktop === isDesktop),
    [contents, isDesktop],
  );
  const saveDoc = async (values: DocumentValues) => {
    setBusy(true);
    setError(null);
    let err: string | null = null;
    let newId: string | null = null;
    const payload = { ...values, updated_at: new Date().toISOString() };
    if (docModal?.record) {
      const { error } = await supabase.from('product_documents').update(payload).eq('id', docModal.record.id);
      err = error?.message ?? null;
    } else if (!productId) {
      err = 'Select a product before creating a document.';
    } else {
      const { data, error } = await supabase
        .from('product_documents')
        .insert({ ...payload, product_id: productId })
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
    setDocModal(null);
    await loadDocs();
    if (newId) setSelectedId(newId);
  };

  const confirmDeleteDoc = async () => {
    if (!deleteDoc) return;
    setBusy(true);
    const { error } = await supabase.from('product_documents').delete().eq('id', deleteDoc.id);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDeleteDoc(null);
    await loadDocs();
  };

  const saveContent = async (values: ContentValues) => {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    let err: string | null = null;
    if (contentModal?.record) {
      const { error } = await supabase
        .from('product_document_content')
        .update(values)
        .eq('id', contentModal.record.id);
      err = error?.message ?? null;
    } else {
      const { error } = await supabase
        .from('product_document_content')
        .insert({ ...values, document_id: selectedId });
      err = error?.message ?? null;
    }
    // Bump parent updated_at so clients can notice a change
    if (!err) {
      await supabase
        .from('product_documents')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedId);
    }
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setContentModal(null);
    setContentPlatform(values.is_desktop ? 'desktop' : 'mobile');
    await loadContents(selectedId);
    await loadDocs();
  };

  const confirmDeleteContent = async () => {
    if (!deleteContent || !selectedId) return;
    setBusy(true);
    const { error } = await supabase.from('product_document_content').delete().eq('id', deleteContent.id);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDeleteContent(null);
    await loadContents(selectedId);
  };

  const copyContentToDesktop = async (content: ContentRow) => {
    if (!selectedId || content.is_desktop || copyingToDesktopId) return;
    setError(null);
    setCopyingToDesktopId(content.id);

    const { error } = await supabase
      .from('product_document_content')
      .insert({
        document_id: selectedId,
        locale: content.locale,
        title: content.title,
        body_html: content.body_html,
        is_desktop: true,
      });

    if (error) {
      setCopyingToDesktopId(null);
      setError(error.message);
      return;
    }

    await supabase
      .from('product_documents')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', selectedId);

    await loadContents(selectedId);
    await loadDocs();
    setCopyingToDesktopId(null);
  };

  const changeSource = async (next: LegalDocumentsSource) => {
    if (next === source || savingSource) return;
    setSavingSource(true);
    setError(null);
    try {
      await setLegalDocumentsSource(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setSavingSource(false);
  };

  if (!productId) {
    return (
      <div>
        <div className="page-head">
          <div>
            <h1 className="page-title">Documents</h1>
            <p className="page-desc">Select a product in the top bar to manage legal documents.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Documents</h1>
          <p className="page-desc">
            Terms, privacy, and other legal HTML the app loads via{' '}
            <code className="doc-inline">/document?slug=…</code>
            {current ? ` · ${current.display_name}` : ''}.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setDocModal({ record: null })}>
          <Plus size={16} />
          New document
        </button>
      </div>

      <div role="group" aria-label="Legal documents source" style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {(['CUSTOM', 'ATOM'] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={`btn btn-sm ${source === option ? 'btn-primary' : 'btn-ghost'}`}
            aria-pressed={source === option}
            disabled={savingSource}
            onClick={() => changeSource(option)}
          >
            {option === 'CUSTOM' ? 'Custom' : 'Atom'}
          </button>
        ))}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {isAtomView && atom.error && <div className="alert alert-error">{atom.error}</div>}
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13 }}>
            {isAtomView ? 'ATOM documents' : 'Documents'}
          </div>
          {loadingDocs ? (
            <Spinner label="Loading…" />
          ) : docs.length === 0 ? (
            <div className="empty">
              <Inbox size={36} className="empty-icon" style={{ margin: '0 auto 12px' }} />
              {isAtomView ? (
                <div>No ATOM documents yet. Create one and pick its ATOM format.</div>
              ) : (
                <div>No documents yet. Create <code>cgu</code> or <code>privacy-policy</code>.</div>
              )}
            </div>
          ) : (
            <div>
              {docs.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedId(d.id)}
                  className="doc-list-item"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px 16px',
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    background: d.id === selectedId ? 'var(--primary-soft)' : 'transparent',
                    cursor: 'pointer',
                    color: 'var(--text)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <FileText size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{documentDisplayTitle(d)}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-faint)', fontFamily: 'ui-monospace, Menlo, monospace' }}>
                        {d.is_atom ? 'documentFormat ' : 'slug '}
                        <code className="doc-inline">{d.slug}</code> · v{d.version}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          {!selected ? (
            <div className="card empty">
              <div>{isAtomView ? 'Select a document to preview it.' : 'Select a document to edit locale content.'}</div>
            </div>
          ) : (
            <>
              <div className="card" style={{ marginBottom: 14, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{documentDisplayTitle(selected)}</div>
                      {selected.is_atom && <span className="badge">ATOM</span>}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
                      {selected.is_atom ? 'documentFormat' : 'Slug'} <code className="doc-inline">{selected.slug}</code>
                      {!selected.is_atom && (
                        <>
                          {' · '}
                          path <code className="doc-inline">{selected.path}</code>
                        </>
                      )}
                      {' · '}
                      v{selected.version}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 6 }}>
                      Translation key: <code className="doc-inline">{selected.title}</code>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 6 }}>
                      App route: <code className="doc-inline">/document?slug={selected.slug}</code>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setDocModal({ record: selected })}>
                      <Pencil size={14} />
                      Edit
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setDeleteDoc(selected)}>
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              {selected.is_atom ? (
                atom.atomProductId && (
                  <AtomPreview key={selected.id} atomProductId={atom.atomProductId} document={selected} />
                )
              ) : (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                    padding: '14px 16px',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div role="group" aria-label="Content platform" style={{ display: 'flex', gap: 4 }}>
                      {(['mobile', 'desktop'] as const).map((platform) => (
                        <button
                          key={platform}
                          type="button"
                          className={`btn btn-sm ${contentPlatform === platform ? 'btn-primary' : 'btn-ghost'}`}
                          aria-pressed={contentPlatform === platform}
                          onClick={() => setContentPlatform(platform)}
                        >
                          {platform === 'mobile' ? 'Mobile' : 'Desktop'}
                        </button>
                      ))}
                    </div>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                      {contentPlatform === 'desktop' ? 'Desktop' : 'Mobile'} locale content
                    </span>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => setContentModal({ record: null })}>
                    <Plus size={14} />
                    Add {contentPlatform === 'desktop' ? 'Desktop' : 'Mobile'} locale
                  </button>
                </div>
                {loadingContents ? (
                  <Spinner label="Loading…" />
                ) : visibleContents.length === 0 ? (
                  <div className="empty" style={{ padding: 40 }}>
                    No {contentPlatform} locale content. Add <code>es</code> (and ideally <code>en</code> for fallback).
                  </div>
                ) : (
                  <div>
                    {visibleContents.map((c) => (
                      <div
                        key={c.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '12px 16px',
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{c.title}</div>
                            <span className="badge">{c.is_desktop ? 'Desktop' : 'Mobile'}</span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>
                            Locale <code className="doc-inline">{c.locale}</code>
                            {' · '}
                            {(c.body_html ?? '').replace(/<[^>]*>/g, ' ').trim().slice(0, 80) || '(empty)'}
                            {(c.body_html ?? '').replace(/<[^>]*>/g, ' ').trim().length > 80 ? '…' : ''}
                          </div>
                        </div>
                        {!c.is_desktop && (
                          <button
                            className="btn btn-ghost btn-sm"
                            disabled={copyingToDesktopId !== null}
                            style={{ opacity: copyingToDesktopId === c.id ? 0.5 : undefined }}
                            onClick={() => copyContentToDesktop(c)}
                          >
                            add to desktop version
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => setContentModal({ record: c })}>
                          <Pencil size={14} />
                          Edit
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setDeleteContent(c)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )}
            </>
          )}
        </div>
      </div>

      {docModal && (
        <DocModal
          record={docModal.record}
          defaultIsAtom={isAtomView}
          atomProductId={atom.atomProductId}
          busy={busy}
          onCancel={() => setDocModal(null)}
          onSubmit={saveDoc}
        />
      )}
      {contentModal && (
        <ContentModal
          record={contentModal.record}
          busy={busy}
          defaultIsDesktop={isDesktop}
          onCancel={() => setContentModal(null)}
          onSubmit={saveContent}
        />
      )}
      {deleteDoc && (
        <ConfirmDialog
          title="Delete document?"
          message={
            deleteDoc.is_atom
              ? `This removes “${deleteDoc.title}” from the app. The ATOM document itself is not changed.`
              : `This removes “${deleteDoc.title}” and all locale content. This cannot be undone.`
          }
          onConfirm={confirmDeleteDoc}
          onCancel={() => setDeleteDoc(null)}
          busy={busy}
        />
      )}
      {deleteContent && (
        <ConfirmDialog
          title="Delete locale content?"
          message={`Remove the ${deleteContent.is_desktop ? 'desktop' : 'mobile'} “${deleteContent.locale}” version of this document?`}
          onConfirm={confirmDeleteContent}
          onCancel={() => setDeleteContent(null)}
          busy={busy}
        />
      )}
    </div>
  );
}

function DocModal({
  record,
  defaultIsAtom,
  atomProductId,
  busy,
  onCancel,
  onSubmit,
}: {
  record: DocumentRow | null;
  defaultIsAtom: boolean;
  atomProductId: string | null;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (v: DocumentValues) => void;
}) {
  const [slug, setSlug] = useState(record?.slug ?? '');
  const [path, setPath] = useState(record?.path ?? '');
  const [title, setTitle] = useState(record?.title ?? '');
  const [version, setVersion] = useState(record?.version ?? 1);
  const [isAtom, setIsAtom] = useState(record?.is_atom ?? defaultIsAtom);
  const [formats, setFormats] = useState<string[]>([]);
  const [loadingFormats, setLoadingFormats] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isAtom || !atomProductId) {
      setFormats([]);
      setLoadingFormats(false);
      return;
    }

    let active = true;
    setLoadingFormats(true);
    setErr(null);
    invokeAtom<AtomDiscoveryResponse>({
      mode: 'discover',
      atom_product_id: atomProductId,
      language: ATOM_DEFAULT_LOCALE,
    })
      .then((data) => {
        if (active) setFormats(data.formatsDiscovered ?? []);
      })
      .catch((e) => {
        if (active) setErr(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (active) setLoadingFormats(false);
      });

    return () => {
      active = false;
    };
  }, [isAtom, atomProductId]);

  const formatOptions = useMemo(() => {
    const options = [...formats];
    if (record?.is_atom && record.slug && !options.includes(record.slug)) {
      options.unshift(record.slug);
    }
    return options;
  }, [formats, record]);

  const submit = () => {
    if (!slug.trim()) {
      setErr(isAtom ? 'Select an ATOM format.' : 'Slug is required.');
      return;
    }
    if (!title.trim()) {
      setErr('Translation key is required.');
      return;
    }
    if (!title.trim().includes('.')) {
      setErr('Translation key must use namespace.key format.');
      return;
    }
    const slugVal = slug.trim();
    const pathVal = isAtom ? slugVal : path.trim() || slugVal;
    onSubmit({ slug: slugVal, path: pathVal, title: title.trim(), version: Number(version) || 1, is_atom: isAtom });
  };

  return (
    <Modal
      title={record ? 'Edit document' : 'New document'}
      onClose={onCancel}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : record ? 'Save changes' : 'Create'}
          </button>
        </>
      }
    >
      {err && <div className="alert alert-error">{err}</div>}
      <div className="field">
        <label>Atom</label>
        <div role="group" aria-label="Document type" style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            className={`btn btn-sm ${isAtom ? 'btn-primary' : 'btn-ghost'}`}
            aria-pressed={isAtom}
            onClick={() => setIsAtom(true)}
            disabled={busy}
          >
            Atom
          </button>
          <button
            type="button"
            className={`btn btn-sm ${!isAtom ? 'btn-primary' : 'btn-ghost'}`}
            aria-pressed={!isAtom}
            onClick={() => setIsAtom(false)}
            disabled={busy}
          >
            Custom
          </button>
        </div>
        {isAtom !== defaultIsAtom && (
          <div className="field-hint" style={{ color: 'var(--primary)' }}>
            Comparirà nel tab {isAtom ? 'Atom' : 'Custom'}.
          </div>
        )}
      </div>
      <div className="field">
        <label htmlFor="doc-slug">{isAtom ? <>Format</> : <>Slug</>} <span style={{ color: 'var(--primary)' }}>*</span></label>
        {isAtom ? (
          <select
            id="doc-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            disabled={busy || loadingFormats}
          >
            <option value="">{loadingFormats ? 'Loading ATOM formats…' : 'Select a format…'}</option>
            {formatOptions.map((format) => (
              <option key={format} value={format}>
                {format}
              </option>
            ))}
          </select>
        ) : (
          <input id="doc-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="cgu" />
        )}
        <div className="field-hint">
          {isAtom
            ? <>Document format to retrieve the html from ATOM</>
            : <>Must match the app route, e.g. <code>cgu</code>, <code>privacy-policy</code>.</>}
        </div>
      </div>
      <div className="field">
        <label htmlFor="doc-title">Title <span style={{ color: 'var(--primary)' }}>*</span></label>
        <input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="documents.privacy_policy" />
        <div className="field-hint">Translation key used to display the document name, e.g. <code>documents.privacy_policy</code>.</div>
      </div>
      {!isAtom && (
        <div className="field">
          <label htmlFor="doc-path">Path</label>
          <input id="doc-path" value={path} onChange={(e) => setPath(e.target.value)} placeholder="cgu" />
          <div className="field-hint">Optional legacy path; defaults to the slug.</div>
        </div>
      )}
      <div className="field">
        <label htmlFor="doc-version">Version</label>
        <input
          id="doc-version"
          type="number"
          min={1}
          value={version}
          onChange={(e) => setVersion(Number(e.target.value))}
        />
      </div>
    </Modal>
  );
}

function ContentModal({
  record,
  busy,
  defaultIsDesktop,
  onCancel,
  onSubmit,
}: {
  record: ContentRow | null;
  busy: boolean;
  defaultIsDesktop: boolean;
  onCancel: () => void;
  onSubmit: (v: ContentValues) => void;
}) {
  const [locale, setLocale] = useState(record?.locale ?? 'es');
  const [title, setTitle] = useState(record?.title ?? '');
  const [bodyHtml, setBodyHtml] = useState(record?.body_html ?? '<p></p>');
  const [isDesktop, setIsDesktop] = useState(record?.is_desktop ?? defaultIsDesktop);
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    if (!locale.trim()) {
      setErr('Locale is required.');
      return;
    }
    if (!title.trim()) {
      setErr('Title is required.');
      return;
    }
    const html = bodyHtml.trim() || '<p></p>';
    onSubmit({
      locale: locale.trim().toLowerCase(),
      title: title.trim(),
      body_html: html,
      is_desktop: isDesktop,
    });
  };

  return (
    <Modal
      title={record ? `Edit content (${record.locale})` : 'Add locale content'}
      onClose={onCancel}
      wide
      footer={
        <>
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : record ? 'Save changes' : 'Create'}
          </button>
        </>
      }
    >
      {err && <div className="alert alert-error">{err}</div>}
      <div className="field">
        <label>Platform <span style={{ color: 'var(--primary)' }}>*</span></label>
        <div role="group" aria-label="Content platform" style={{ display: 'flex', gap: 4 }}>
          {(['mobile', 'desktop'] as const).map((platform) => (
            <button
              key={platform}
              type="button"
              className={`btn btn-sm ${isDesktop === (platform === 'desktop') ? 'btn-primary' : 'btn-ghost'}`}
              aria-pressed={isDesktop === (platform === 'desktop')}
              onClick={() => setIsDesktop(platform === 'desktop')}
              disabled={busy}
            >
              {platform === 'mobile' ? 'Mobile' : 'Desktop'}
            </button>
          ))}
        </div>
        <div className="field-hint">Mobile app and desktop browser can have different legal text for the same slug.</div>
      </div>
      <div className="field">
        <label htmlFor="content-locale">Locale <span style={{ color: 'var(--primary)' }}>*</span></label>
        <input
          id="content-locale"
          value={locale}
          onChange={(e) => setLocale(e.target.value)}
          placeholder="es"
          disabled={!!record}
        />
        <div className="field-hint">App language code (e.g. <code>es</code>). Edge function falls back to <code>en</code>.</div>
      </div>
      <div className="field">
        <label htmlFor="content-title">Title <span style={{ color: 'var(--primary)' }}>*</span></label>
        <input id="content-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <label>Body</label>
        <HtmlBodyEditor value={bodyHtml} onChange={setBodyHtml} disabled={busy} />
        <div className="field-hint">
          Paste from Word or Docs. Kept: headings, paragraphs, lists, bold, italic, underline.
        </div>
      </div>
    </Modal>
  );
}

function AtomPreview({ atomProductId, document }: { atomProductId: string; document: DocumentRow }) {
  const [locale, setLocale] = useState(ATOM_DEFAULT_LOCALE);
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (lang: string) => {
    if (!lang) return;
    setLoading(true);
    setError(null);
    try {
      const data = await invokeAtom<{ document: { body_html: string } }>({
        mode: 'document',
        atom_product_id: atomProductId,
        language: lang,
        format: document.slug,
      });
      setHtml(data.document.body_html);
    } catch (e) {
      setHtml(null);
      setError(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }, [atomProductId, document.slug]);

  useEffect(() => {
    load(ATOM_DEFAULT_LOCALE);
  }, [load]);

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13 }}>
          ATOM preview · product <code className="doc-inline">{atomProductId}</code>
        </span>
        <form
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            load(locale.trim().toLowerCase());
          }}
        >
          <label htmlFor="atom-preview-locale" style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Locale</label>
          <input
            id="atom-preview-locale"
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            placeholder="fr"
            style={{ width: 72 }}
          />
          <button type="submit" className="btn btn-ghost btn-sm" disabled={loading}>
            <RefreshCw size={14} />
            Refresh
          </button>
        </form>
      </div>
      {loading ? (
        <Spinner label="Loading…" />
      ) : error ? (
        <div className="alert alert-error" style={{ margin: 16 }}>{error}</div>
      ) : html !== null ? (
        <iframe
          title={document.title}
          sandbox=""
          srcDoc={html}
          style={{ width: '100%', height: '70vh', border: 'none', background: '#fff', display: 'block' }}
        />
      ) : null}
    </div>
  );
}
