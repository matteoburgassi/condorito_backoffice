import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, FileText, Inbox } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useProduct } from '../lib/ProductContext';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Spinner } from '../components/Spinner';
import { HtmlBodyEditor } from '../components/HtmlBodyEditor';

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
};

export function DocumentsPage() {
  const { productId, current } = useProduct();
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contents, setContents] = useState<ContentRow[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadingContents, setLoadingContents] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [docModal, setDocModal] = useState<{ record: DocumentRow | null } | null>(null);
  const [contentModal, setContentModal] = useState<{ record: ContentRow | null } | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<DocumentRow | null>(null);
  const [deleteContent, setDeleteContent] = useState<ContentRow | null>(null);
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

  const saveContent = async (values: { locale: string; title: string; body_html: string }) => {
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

      {error && <div className="alert alert-error">{error}</div>}

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
                    padding: '14px 16px',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Locale content</div>
                  <button className="btn btn-primary btn-sm" onClick={() => setContentModal({ record: null })}>
                    <Plus size={14} />
                    Add locale
                  </button>
                </div>
                {loadingContents ? (
                  <Spinner label="Loading…" />
                ) : contents.length === 0 ? (
                  <div className="empty" style={{ padding: 40 }}>
                    No locale content. Add <code>es</code> (and ideally <code>en</code> for fallback).
                  </div>
                ) : (
                  <div>
                    {contents.map((c) => (
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
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{c.title}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>
                            Locale <code className="doc-inline">{c.locale}</code>
                            {' · '}
                            {(c.body_html ?? '').replace(/<[^>]*>/g, ' ').trim().slice(0, 80) || '(empty)'}
                            {(c.body_html ?? '').replace(/<[^>]*>/g, ' ').trim().length > 80 ? '…' : ''}
                          </div>
                        </div>
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
          message={`Remove the “${deleteContent.locale}” version of this document?`}
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
  onCancel,
  onSubmit,
}: {
  record: ContentRow | null;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (v: { locale: string; title: string; body_html: string }) => void;
}) {
  const [locale, setLocale] = useState(record?.locale ?? 'es');
  const [title, setTitle] = useState(record?.title ?? '');
  const [bodyHtml, setBodyHtml] = useState(record?.body_html ?? '<p></p>');
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
    onSubmit({ locale: locale.trim().toLowerCase(), title: title.trim(), body_html: html });
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
