import { defaultsFromSchema, type WidgetSchema } from '../lib/widgetCatalog';
import {
  asWidgetConfig,
  setTranslationKey,
  translatableProperties,
  valueAtConfigPath,
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

export function optionalObjectDefaults(schema: WidgetSchema): SchemaFormValue {
  const result: SchemaFormValue = {};
  for (const [key, property] of Object.entries(schema.properties ?? {})) {
    const value = defaultsFromSchema(property);
    if (value !== undefined) result[key] = value;
  }
  return result;
}

export function changeDataBindingSource(value: unknown, source: string): SchemaFormValue {
  const next: SchemaFormValue = { ...asRecord(value), source };
  if (source === 'continue_reading') {
    delete next.containerId;
    delete next.limit;
  }
  return next;
}

export function changeActionType(value: unknown, type: string): SchemaFormValue {
  const next: SchemaFormValue = { ...asRecord(value), type };
  if (type !== 'navigate' && type !== 'premium_gate') delete next.route;
  if (type !== 'open_webview') delete next.url;
  return next;
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
    if (schema['x-control'] === 'data-binding') {
      const binding = asRecord(value);
      const source = typeof binding.source === 'string' ? binding.source : 'comics';
      const properties = schema.properties ?? {};
      return (
        <fieldset className="field">
          <legend>{label}</legend>
          {schema.description && <div className="field-hint">{schema.description}</div>}
          {properties.source && (
            <Field
              schema={properties.source}
              path={[...path, 'source']}
              value={source}
              onChange={(sourcePath, nextSource) => {
                if (typeof nextSource === 'string') {
                  onChange(path, changeDataBindingSource(binding, nextSource));
                } else {
                  onChange(sourcePath, nextSource);
                }
              }}
              errors={errors}
              required
            />
          )}
          {(source === 'comics' || source === 'container') && properties.containerId && (
            <Field
              schema={{
                ...properties.containerId,
                description: source === 'container'
                  ? 'Required fixed container identifier.'
                  : 'Optional. Leave empty to use the current screen slug.',
              }}
              path={[...path, 'containerId']}
              value={binding.containerId}
              onChange={onChange}
              errors={errors}
              required={source === 'container'}
            />
          )}
          {(source === 'comics' || source === 'container') && properties.limit && (
            <Field
              schema={properties.limit}
              path={[...path, 'limit']}
              value={binding.limit}
              onChange={onChange}
              errors={errors}
            />
          )}
          {source === 'continue_reading' && (
            <div className="field-hint">
              Uses the signed-in user’s saved progress; no source parameters are required.
            </div>
          )}
        </fieldset>
      );
    }

    if (schema['x-control'] === 'action') {
      const action = asRecord(value);
      const actionType = typeof action.type === 'string' ? action.type : 'navigate';
      const properties = schema.properties ?? {};
      return (
        <fieldset className="field">
          <legend>{label}</legend>
          {schema.description && <div className="field-hint">{schema.description}</div>}
          {properties.type && (
            <Field
              schema={properties.type}
              path={[...path, 'type']}
              value={actionType}
              onChange={(typePath, nextType) => {
                if (typeof nextType === 'string') {
                  onChange(path, changeActionType(action, nextType));
                } else {
                  onChange(typePath, nextType);
                }
              }}
              errors={errors}
              required
            />
          )}
          {(actionType === 'navigate' || actionType === 'premium_gate') && properties.route && (
            <Field
              schema={{
                ...properties.route,
                description: actionType === 'navigate'
                  ? 'Route opened when the header action is pressed.'
                  : 'Optional route retained for the premium gate.',
              }}
              path={[...path, 'route']}
              value={action.route}
              onChange={onChange}
              errors={errors}
              required={actionType === 'navigate'}
            />
          )}
          {actionType === 'open_webview' && properties.url && (
            <Field
              schema={{
                ...properties.url,
                description: 'Web address opened by the header action.',
              }}
              path={[...path, 'url']}
              value={action.url}
              onChange={onChange}
              errors={errors}
              required
            />
          )}
        </fieldset>
      );
    }

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
    if (schema['x-optional']) {
      const enabled = value !== null && typeof value === 'object' && !Array.isArray(value);
      return (
        <div className="field">
          <Switch
            checked={enabled}
            onChange={(checked) => onChange(
              path,
              checked ? optionalObjectDefaults(schema) : undefined,
            )}
            label={`Enable ${label}`}
          />
          {schema.description && <div className="field-hint">{schema.description}</div>}
          {enabled && <fieldset style={{ marginTop: 8 }}>{content}</fieldset>}
        </div>
      );
    }
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
  const fields = translatableProperties(schema).filter(({ key }) => {
    const parentPath = key.split('.').slice(0, -1).join('.');
    if (!parentPath) return true;
    const parent = valueAtConfigPath(value, parentPath);
    return parent !== null && typeof parent === 'object' && !Array.isArray(parent);
  });
  if (fields.length === 0) return null;

  const i18n = asWidgetConfig(value.i18n);

  return (
    <div className="field">
      <label>Translations</label>
      <div className="card" style={{ padding: 14 }}>
        {fields.map(({ key, property }) => {
          const enabled = Object.prototype.hasOwnProperty.call(i18n, key);
          const translationKey = typeof i18n[key] === 'string' ? i18n[key] : '';
          const rawFallback = valueAtConfigPath(value, key);
          const fallback = typeof rawFallback === 'string' ? rawFallback : '';

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
