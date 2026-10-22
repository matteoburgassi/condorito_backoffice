import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, FileText, Inbox, RefreshCw } from 'lucide-react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useProduct, type LegalDocumentsSource, type Product } from '../lib/ProductContext';
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

type AtomDocument = {
  id: string;
  name: string;
  documentFormat: string;
};

const ATOM_FUNCTION = 'get-atom-legal-document';
const ATOM_DEFAULT_LOCALE = 'es';

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

export function DocumentsPage() {
  const { productId, current, setLegalDocumentsSource } = useProduct();
  const source: LegalDocumentsSource = current?.legal_documents_source ?? 'CUSTOM';
  const [savingSource, setSavingSource] = useState(false);
  const [docs, setDocs] = useState<DocumentRow[]>([]);
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
    const { data, error } = await supabase
      .from('product_documents')
      .select('*')
      .eq('product_id', productId)
      .order('slug');
    if (error) setError(error.message);
    else {
      const list = (data as DocumentRow[]) ?? [];
      setDocs(list);
      setSelectedId((prev) => (prev && list.some((d) => d.id === prev) ? prev : list[0]?.id ?? null));
    }
    setLoadingDocs(false);
  }, [productId]);

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
    if (selectedId) loadContents(selectedId);
    else setContents([]);
  }, [selectedId, loadContents]);

  const selected = docs.find((d) => d.id === selectedId) ?? null;
  const isDesktop = isDesktopPlatform(contentPlatform);
  const visibleContents = useMemo(
    () => contents.filter((c) => c.is_desktop === isDesktop),
    [contents, isDesktop],
  );

  const saveDoc = async (values: { slug: string; path: string; title: string; version: number }) => {
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
        {source === 'CUSTOM' && (
          <button className="btn btn-primary" onClick={() => setDocModal({ record: null })}>
            <Plus size={16} />
            New document
          </button>
        )}
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

      {source === 'ATOM' && current ? (
        <AtomDocumentsPanel key={current.id} product={current} />
      ) : (
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13 }}>
            Documents
          </div>
          {loadingDocs ? (
            <Spinner label="Loading…" />
          ) : docs.length === 0 ? (
            <div className="empty">
              <Inbox size={36} className="empty-icon" style={{ margin: '0 auto 12px' }} />
              <div>No documents yet. Create <code>cgu</code> or <code>privacy-policy</code>.</div>
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
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{d.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-faint)', fontFamily: 'ui-monospace, Menlo, monospace' }}>
                        {d.slug} · v{d.version}
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
              <div>Select a document to edit locale content.</div>
            </div>
          ) : (
            <>
              <div className="card" style={{ marginBottom: 14, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{selected.title}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
                      Slug <code className="doc-inline">{selected.slug}</code>
                      {' · '}
                      path <code className="doc-inline">{selected.path}</code>
                      {' · '}
                      v{selected.version}
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
            </>
          )}
        </div>
      </div>
      )}

      {docModal && (
        <DocModal
          record={docModal.record}
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
          message={`This removes “${deleteDoc.title}” and all locale content. This cannot be undone.`}
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
  busy,
  onCancel,
  onSubmit,
}: {
  record: DocumentRow | null;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (v: { slug: string; path: string; title: string; version: number }) => void;
}) {
  const [slug, setSlug] = useState(record?.slug ?? '');
  const [path, setPath] = useState(record?.path ?? '');
  const [title, setTitle] = useState(record?.title ?? '');
  const [version, setVersion] = useState(record?.version ?? 1);
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    if (!slug.trim()) {
      setErr('Slug is required.');
      return;
    }
    if (!title.trim()) {
      setErr('Title is required.');
      return;
    }
    const pathVal = path.trim() || slug.trim();
    onSubmit({ slug: slug.trim(), path: pathVal, title: title.trim(), version: Number(version) || 1 });
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
        <label htmlFor="doc-slug">Slug <span style={{ color: 'var(--primary)' }}>*</span></label>
        <input id="doc-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="cgu" />
        <div className="field-hint">Must match the app route, e.g. <code>cgu</code>, <code>privacy-policy</code>.</div>
      </div>
      <div className="field">
        <label htmlFor="doc-title">Title <span style={{ color: 'var(--primary)' }}>*</span></label>
        <input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Términos y Condiciones" />
      </div>
      <div className="field">
        <label htmlFor="doc-path">Path</label>
        <input id="doc-path" value={path} onChange={(e) => setPath(e.target.value)} placeholder="cgu" />
        <div className="field-hint">Optional legacy path; defaults to the slug.</div>
      </div>
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

function AtomDocumentsPanel({ product }: { product: Product }) {
  const [atomProductId, setAtomProductId] = useState<string | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [locale, setLocale] = useState(ATOM_DEFAULT_LOCALE);
  const [discoveredLocale, setDiscoveredLocale] = useState(ATOM_DEFAULT_LOCALE);
  const [documents, setDocuments] = useState<AtomDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ doc: AtomDocument; html: string | null; error: string | null } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from('product_config')
        .select('value')
        .eq('product_id', product.id)
        .eq('key', 'ATOM_PRODUCT_ID')
        .maybeSingle();
      if (!active) return;
      if (error) setError(error.message);
      setAtomProductId(data?.value?.trim() || null);
      setLoadingConfig(false);
    })();
    return () => {
      active = false;
    };
  }, [product.id]);

  const discover = useCallback(async (lang: string) => {
    if (!atomProductId || !lang) return;
    setLoadingDocs(true);
    setError(null);
    setDiscoveredLocale(lang);
    try {
      const data = await invokeAtom<{ documents: AtomDocument[] }>({
        mode: 'discover',
        atom_product_id: atomProductId,
        language: lang,
      });
      setDocuments(data.documents ?? []);
    } catch (e) {
      setDocuments([]);
      setError(e instanceof Error ? e.message : String(e));
    }
    setLoadingDocs(false);
  }, [atomProductId]);

  useEffect(() => {
    discover(ATOM_DEFAULT_LOCALE);
  }, [discover]);

  const openPreview = async (doc: AtomDocument) => {
    if (!atomProductId) return;
    setPreview({ doc, html: null, error: null });
    try {
      const data = await invokeAtom<{ document: { body_html: string } }>({
        mode: 'document',
        atom_product_id: atomProductId,
        language: discoveredLocale,
        format: doc.documentFormat,
      });
      setPreview((prev) => (prev?.doc.id === doc.id ? { doc, html: data.document.body_html, error: null } : prev));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setPreview((prev) => (prev?.doc.id === doc.id ? { doc, html: null, error: message } : prev));
    }
  };

  if (loadingConfig) return <Spinner label="Loading…" />;

  if (!atomProductId) {
    return (
      <div className="alert alert-error">
        Missing <code className="doc-inline">ATOM_PRODUCT_ID</code> in Config Values for {product.display_name}.
      </div>
    );
  }

  return (
    <>
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
          <div style={{ fontWeight: 600, fontSize: 13 }}>
            ATOM documents · product <code className="doc-inline">{atomProductId}</code>
          </div>
          <form
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            onSubmit={(e) => {
              e.preventDefault();
              discover(locale.trim().toLowerCase());
            }}
          >
            <label htmlFor="atom-locale" style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Locale</label>
            <input
              id="atom-locale"
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              placeholder="es"
              style={{ width: 72 }}
            />
            <button type="submit" className="btn btn-ghost btn-sm" disabled={loadingDocs}>
              <RefreshCw size={14} />
              Refresh
            </button>
          </form>
        </div>
        {error && <div className="alert alert-error" style={{ margin: 16 }}>{error}</div>}
        {loadingDocs ? (
          <Spinner label="Loading…" />
        ) : documents.length === 0 ? (
          <div className="empty" style={{ padding: 40 }}>
            <Inbox size={36} className="empty-icon" style={{ margin: '0 auto 12px' }} />
            <div>No ATOM documents available for locale <code>{discoveredLocale}</code>.</div>
          </div>
        ) : (
          <div>
            {documents.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => openPreview(d)}
                className="doc-list-item"
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 16px',
                  border: 'none',
                  borderBottom: '1px solid var(--border)',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--text)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FileText size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{d.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-faint)', fontFamily: 'ui-monospace, Menlo, monospace' }}>
                      {d.documentFormat}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {preview && (
        <Modal
          title={`${preview.doc.name} (${discoveredLocale})`}
          onClose={() => setPreview(null)}
          wide
          footer={<button className="btn btn-ghost" onClick={() => setPreview(null)}>Close</button>}
        >
          {preview.error ? (
            <div className="alert alert-error">{preview.error}</div>
          ) : preview.html === null ? (
            <Spinner label="Loading…" />
          ) : (
            <iframe
              title={preview.doc.name}
              sandbox=""
              srcDoc={preview.html}
              style={{ width: '100%', height: '70vh', border: '1px solid var(--border)', borderRadius: 6, background: '#fff' }}
            />
          )}
        </Modal>
      )}
    </>
  );
}
