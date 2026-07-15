import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, Inbox } from 'lucide-react';
import { resourceByKey, isResourceVisible, type Resource } from '../lib/resources';
import { supabase } from '../lib/supabase';
import { useProduct } from '../lib/ProductContext';
import { Modal } from '../components/Modal';
import { RecordForm, type FormValues } from '../components/RecordForm';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Switch } from '../components/Switch';
import { Spinner } from '../components/Spinner';

type Row = Record<string, unknown> & { id: string };

function formatCell(resource: Resource, col: string, value: unknown) {
  const field = resource.fields.find((f) => f.name === col);
  if (value == null || value === '') return <span style={{ color: 'var(--text-faint)' }}>—</span>;
  if (field?.type === 'json' || typeof value === 'object') {
    return <span className="cell-mono cell-truncate">{JSON.stringify(value)}</span>;
  }
  if (col === 'id' || col.endsWith('_id') || field?.pkInput) {
    return <span className="cell-mono cell-truncate">{String(value)}</span>;
  }
  return <span className="cell-truncate">{String(value)}</span>;
}

export function ResourcePage() {
  const { key = '' } = useParams();
  const resource = isResourceVisible(key) ? resourceByKey(key) : undefined;
  const { productId, current } = useProduct();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState<{ record: Row | null } | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const scopedBlocked = !!resource?.productScoped && !productId;

  const load = useCallback(async () => {
    if (!resource || scopedBlocked) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    let q = supabase.from(resource.table).select('*');
    if (resource.productScoped && productId) q = q.eq('product_id', productId);
    if (resource.defaultSort) q = q.order(resource.defaultSort.column, { ascending: resource.defaultSort.ascending });
    const { data, error } = await q;
    if (error) {
      setError(error.message);
      setRows([]);
    } else {
      setRows((data as Row[]) ?? []);
    }
    setLoading(false);
  }, [resource, productId, scopedBlocked]);

  useEffect(() => {
    setSearch('');
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q));
  }, [rows, search]);

  if (!resource) {
    return <div className="alert alert-error">Unknown resource.</div>;
  }

  const save = async (values: FormValues) => {
    setSubmitting(true);
    setActionError(null);
    let err: string | null = null;

    if (editing?.record) {
      const { error } = await supabase.from(resource.table).update(values).eq('id', editing.record.id);
      err = error?.message ?? null;
    } else {
      const payload = { ...values };
      if (resource.productScoped && productId) payload.product_id = productId;
      const { error } = await supabase.from(resource.table).insert(payload);
      err = error?.message ?? null;
    }

    setSubmitting(false);
    if (err) {
      setActionError(err);
      return;
    }
    setEditing(null);
    await load();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setSubmitting(true);
    setActionError(null);
    const { error } = await supabase.from(resource.table).delete().eq('id', deleting.id);
    setSubmitting(false);
    if (error) {
      setActionError(error.message);
      return;
    }
    setDeleting(null);
    await load();
  };

  const toggleBool = async (row: Row, col: string) => {
    const next = !row[col];
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, [col]: next } : r)));
    const { error } = await supabase.from(resource.table).update({ [col]: next }).eq('id', row.id);
    if (error) {
      setActionError(error.message);
      load();
    }
  };

  const boolCols = new Set(resource.fields.filter((f) => f.type === 'boolean').map((f) => f.name));

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">{resource.label}</h1>
          <p className="page-desc">
            {resource.description}
            {resource.productScoped && current ? ` · ${current.display_name}` : ''}
          </p>
        </div>
        {!scopedBlocked && (
          <button className="btn btn-primary" onClick={() => { setActionError(null); setEditing({ record: null }); }}>
            <Plus size={16} />
            New {resource.singular}
          </button>
        )}
      </div>

      {scopedBlocked ? (
        <div className="card empty">Select a product to manage {resource.label.toLowerCase()}.</div>
      ) : (
        <>
          <div className="toolbar">
            <div className="search">
              <Search size={15} />
              <input placeholder={`Search ${resource.label.toLowerCase()}...`} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {filtered.length} {filtered.length === 1 ? 'row' : 'rows'}
            </span>
          </div>

          {error && <div className="alert alert-error">Failed to load: {error}</div>}
          {actionError && <div className="alert alert-error">{actionError}</div>}

          {loading ? (
            <Spinner label="Loading..." />
          ) : filtered.length === 0 ? (
            <div className="card empty">
              <div className="empty-icon">
                <Inbox size={40} />
              </div>
              {rows.length === 0 ? `No ${resource.label.toLowerCase()} yet.` : 'No rows match your search.'}
            </div>
          ) : (
            <div className="card table-wrap">
              <table>
                <thead>
                  <tr>
                    {resource.listColumns.map((c) => (
                      <th key={c}>{resource.fields.find((f) => f.name === c)?.label ?? c}</th>
                    ))}
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id}>
                      {resource.listColumns.map((c) => (
                        <td key={c}>
                          {boolCols.has(c) ? (
                            <Switch checked={!!row[c]} onChange={() => toggleBool(row, c)} />
                          ) : (
                            formatCell(resource, c, row[c])
                          )}
                        </td>
                      ))}
                      <td>
                        <div className="row-actions">
                          <button className="btn-icon" title="Edit" onClick={() => { setActionError(null); setEditing({ record: row }); }}>
                            <Pencil size={15} />
                          </button>
                          <button className="btn-icon" title="Delete" onClick={() => { setActionError(null); setDeleting(row); }}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {editing && (
        <Modal
          title={editing.record ? `Edit ${resource.singular}` : `New ${resource.singular}`}
          onClose={() => setEditing(null)}
        >
          {actionError && <div className="alert alert-error">{actionError}</div>}
          <RecordForm
            resource={resource}
            record={editing.record}
            submitting={submitting}
            onCancel={() => setEditing(null)}
            onSubmit={save}
          />
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title={`Delete ${resource.singular}?`}
          message="This permanently removes the row from the shared Condorito database. This cannot be undone."
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
          busy={submitting}
        />
      )}
    </div>
  );
}
