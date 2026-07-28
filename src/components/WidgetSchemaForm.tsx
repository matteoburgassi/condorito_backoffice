import type { WidgetSchema } from '../lib/widgetCatalog';
import {
  asWidgetConfig,
  setTranslationKey,
  translatableProperties,
} from '../lib/widgetSchema';
import { Switch } from './Switch';

export type SchemaFormValue = Record<string, unknown>;

type Props = {
  schema: WidgetSchema;
  value: SchemaFormValue;
  onChange: (value: SchemaFormValue) => void;
  errors?: Record<string, string>;
};

function asRecord(value: unknown): SchemaFormValue {
  return asWidgetConfig(value);
}

export function setValueAtPath(
  source: SchemaFormValue,
  path: string[],
  value: unknown,
): SchemaFormValue {
  if (path.length === 0) return asRecord(value);
  const [key, ...rest] = path;
  if (rest.length === 0 && value === undefined) {
    const next = { ...source };
    delete next[key];
    return next;
  }
  return {
    ...source,
    [key]: rest.length === 0
      ? value
      : setValueAtPath(asRecord(source[key]), rest, value),
  };
}

export function parseNumberInput(value: string): number | string {
  if (value === '') return '';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

export function addArrayItem<T>(items: T[], value: T): T[] {
  return [...items, value];
}

export function updateArrayItem<T>(items: T[], index: number, value: T): T[] {
  return items.map((item, itemIndex) => itemIndex === index ? value : item);
}

export function removeArrayItem<T>(items: T[], index: number): T[] {
  return items.filter((_, itemIndex) => itemIndex !== index);
}

function Field({
  schema,
  path,
  value,
  onChange,
  errors,
  required = false,
}: {
  schema: WidgetSchema;
  path: string[];
  value: unknown;
  onChange: (path: string[], value: unknown) => void;
  errors: Record<string, string>;
  required?: boolean;
}) {
  const fieldPath = path.join('.');
  const id = `schema-${path.join('-') || 'root'}`;
  const label = schema.title ?? path[path.length - 1] ?? '';
  const error = errors[fieldPath];

  if (schema.type === 'object') {
    const content = (
      <>
        {Object.entries(schema.properties ?? {}).map(([key, childSchema]) => (
          <Field
            key={key}
            schema={childSchema}
            path={[...path, key]}
            value={asRecord(value)[key]}
            onChange={onChange}
            errors={errors}
            required={schema.required?.includes(key)}
          />
        ))}
      </>
    );

    if (path.length === 0) return <div>{content}</div>;
    return (
      <fieldset className="field">
        <legend>{label}</legend>
        {schema.description && <div className="field-hint">{schema.description}</div>}
        {content}
      </fieldset>
    );
  }

  if (schema.type === 'string') {
    if (schema.enum?.length) {
      return (
        <div className="field">
          <label htmlFor={id}>
            {label}
            {required && <span style={{ color: 'var(--primary)' }}> *</span>}
          </label>
          <select
            id={id}
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => onChange(
              path,
              event.target.value === '' ? undefined : event.target.value,
            )}
            aria-invalid={!!error}
          >
            {!required && <option value="">Default</option>}
            {schema.enum.map((option) => (
              <option key={String(option)} value={String(option)}>{option}</option>
            ))}
          </select>
          {error
            ? <div className="field-hint" style={{ color: 'var(--error)' }}>{error}</div>
            : schema.description && <div className="field-hint">{schema.description}</div>}
        </div>
      );
    }

    const inputProps = {
      id,
      value: typeof value === 'string' ? value : '',
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        onChange(path, event.target.value),
      'aria-invalid': !!error,
    };

    return (
      <div className="field">
        <label htmlFor={id}>
          {label}
          {required && <span style={{ color: 'var(--primary)' }}> *</span>}
        </label>
        {schema['x-control'] === 'textarea'
          ? <textarea {...inputProps} rows={6} />
          : <input {...inputProps} />}
        {error
          ? <div className="field-hint" style={{ color: 'var(--error)' }}>{error}</div>
          : schema.description && <div className="field-hint">{schema.description}</div>}
      </div>
    );
  }

  if (schema.type === 'number') {
    return (
      <div className="field">
        <label htmlFor={id}>
          {label}
          {required && <span style={{ color: 'var(--primary)' }}> *</span>}
        </label>
        <input
          id={id}
          type="number"
          step="any"
          value={typeof value === 'number' || typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(path, parseNumberInput(event.target.value))}
          aria-invalid={!!error}
        />
        {error
          ? <div className="field-hint" style={{ color: 'var(--error)' }}>{error}</div>
          : schema.description && <div className="field-hint">{schema.description}</div>}
      </div>
    );
  }

  if (schema.type === 'boolean') {
    return (
      <div className="field">
        <Switch
          checked={typeof value === 'boolean' ? value : false}
          onChange={(checked) => onChange(path, checked)}
          label={label}
        />
        {error
          ? <div className="field-hint" style={{ color: 'var(--error)' }}>{error}</div>
          : schema.description && <div className="field-hint">{schema.description}</div>}
      </div>
    );
  }

  if (schema.type === 'array' && schema.items?.type === 'string') {
    const items = Array.isArray(value)
      ? value.map((item) => typeof item === 'string' ? item : String(item ?? ''))
      : [];
    const newItemDefault = typeof schema.items.default === 'string'
      ? schema.items.default
      : '';

    return (
      <div className="field">
        <label>
          {label}
          {required && <span style={{ color: 'var(--primary)' }}> *</span>}
        </label>
        {schema.description && !error && <div className="field-hint">{schema.description}</div>}
        {error && <div className="field-hint" style={{ color: 'var(--error)' }}>{error}</div>}
        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
          {items.map((item, index) => {
            const itemError = errors[`${fieldPath}.${index}`];
            return (
              <div key={index}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    aria-label={`${schema.items?.title ?? 'Item'} ${index + 1}`}
                    value={item}
                    onChange={(event) => onChange(
                      path,
                      updateArrayItem(items, index, event.target.value),
                    )}
                    aria-invalid={!!itemError}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => onChange(path, removeArrayItem(items, index))}
                  >
                    Remove
                  </button>
                </div>
                {itemError && (
                  <div className="field-hint" style={{ color: 'var(--error)' }}>{itemError}</div>
                )}
              </div>
            );
          })}
          <div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onChange(path, addArrayItem(items, newItemDefault))}
            >
              Add {schema.items.title ?? 'item'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="field">
      <div className="field-hint">
        The generated editor does not support <code>{schema.type}</code> fields yet.
      </div>
    </div>
  );
}

export function WidgetSchemaForm({
  schema,
  value,
  onChange,
  errors = {},
}: Props) {
  const update = (path: string[], nextValue: unknown) => {
    onChange(setValueAtPath(value, path, nextValue));
  };

  return (
    <Field
      schema={schema}
      path={[]}
      value={value}
      onChange={update}
      errors={errors}
    />
  );
}

export function WidgetTranslationFields({
  schema,
  value,
  onChange,
}: {
  schema: WidgetSchema;
  value: SchemaFormValue;
  onChange: (value: SchemaFormValue) => void;
}) {
  const fields = translatableProperties(schema);
  if (fields.length === 0) return null;

  const i18n = asWidgetConfig(value.i18n);

  return (
    <div className="field">
      <label>Translations</label>
      <div className="card" style={{ padding: 14 }}>
        {fields.map(({ key, property }) => {
          const enabled = Object.prototype.hasOwnProperty.call(i18n, key);
          const translationKey = typeof i18n[key] === 'string' ? i18n[key] : '';
          const fallback = typeof value[key] === 'string' ? value[key] : '';

          return (
            <div key={key} style={{ marginBottom: 14 }}>
              <Switch
                checked={enabled}
                onChange={(checked) => onChange(setTranslationKey(value, key, checked ? '' : undefined))}
                label={`Translate ${property.title ?? key}`}
              />
              {enabled && (
                <div style={{ marginTop: 8 }}>
                  <label htmlFor={`translation-${key}`}>Translation key</label>
                  <input
                    id={`translation-${key}`}
                    value={translationKey}
                    onChange={(event) => onChange(setTranslationKey(value, key, event.target.value))}
                    placeholder="namespace.key"
                  />
                  <div className="field-hint">
                    Literal fallback: <code>{fallback || '—'}</code>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
