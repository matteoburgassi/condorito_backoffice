import { useState } from 'react';
import type { Field, Resource } from '../lib/resources';
import { Switch } from './Switch';

export type FormValues = Record<string, unknown>;

function initialFor(resource: Resource, record: FormValues | null): FormValues {
  const v: FormValues = {};
  for (const f of resource.fields) {
    if (record && f.name in record) {
      const raw = record[f.name];
      v[f.name] = f.type === 'json' ? (raw == null ? '' : JSON.stringify(raw, null, 2)) : raw ?? (f.type === 'boolean' ? false : '');
    } else {
      v[f.name] = f.type === 'boolean' ? false : '';
    }
  }
  return v;
}

export function RecordForm({
  resource,
  record,
  onSubmit,
  onCancel,
  submitting,
}: {
  resource: Resource;
  record: FormValues | null;
  onSubmit: (values: FormValues) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const isEdit = record !== null;
  const [values, setValues] = useState<FormValues>(() => initialFor(resource, record));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (name: string, val: unknown) => setValues((prev) => ({ ...prev, [name]: val }));

  const isPkLocked = (f: Field) => f.pkInput && isEdit;

  const handleSubmit = () => {
    const nextErrors: Record<string, string> = {};
    const payload: FormValues = {};

    for (const f of resource.fields) {
      if (isPkLocked(f)) continue; // never change a text PK on edit
      const raw = values[f.name];

      if (f.type === 'boolean') {
        payload[f.name] = !!raw;
        continue;
      }

      const strVal = typeof raw === 'string' ? raw.trim() : raw;
      const empty = strVal === '' || strVal == null;

      if (f.required && empty) {
        nextErrors[f.name] = 'Required';
        continue;
      }

      if (empty) {
        payload[f.name] = f.type === 'json' ? null : null;
        continue;
      }

      if (f.type === 'number') {
        const n = Number(strVal);
        if (Number.isNaN(n)) {
          nextErrors[f.name] = 'Must be a number';
        } else {
          payload[f.name] = n;
        }
      } else if (f.type === 'json') {
        try {
          payload[f.name] = JSON.parse(strVal as string);
        } catch {
          nextErrors[f.name] = 'Invalid JSON';
        }
      } else {
        payload[f.name] = strVal;
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    onSubmit(payload);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      {resource.fields.map((f) => {
        if (isPkLocked(f)) return null;
        const val = values[f.name];
        return (
          <div className="field" key={f.name}>
            {f.type !== 'boolean' && (
              <label htmlFor={f.name}>
                {f.label}
                {f.required && <span style={{ color: 'var(--primary)' }}> *</span>}
              </label>
            )}

            {f.type === 'boolean' ? (
              <Switch checked={!!val} onChange={(v) => set(f.name, v)} label={f.label} />
            ) : f.type === 'textarea' || f.type === 'json' ? (
              <textarea
                id={f.name}
                value={(val as string) ?? ''}
                onChange={(e) => set(f.name, e.target.value)}
                placeholder={f.type === 'json' ? '{ }' : ''}
                spellCheck={false}
              />
            ) : (
              <input
                id={f.name}
                type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                step={f.type === 'number' ? 'any' : undefined}
                value={(val as string) ?? ''}
                onChange={(e) => set(f.name, e.target.value)}
              />
            )}

            {errors[f.name] && <div className="field-hint" style={{ color: 'var(--error)' }}>{errors[f.name]}</div>}
            {!errors[f.name] && f.hint && <div className="field-hint">{f.hint}</div>}
          </div>
        );
      })}

      <div className="modal-foot" style={{ margin: '4px -22px -22px', paddingBottom: 0, paddingTop: 16 }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Saving...' : isEdit ? 'Save changes' : 'Create'}
        </button>
      </div>
    </form>
  );
}
