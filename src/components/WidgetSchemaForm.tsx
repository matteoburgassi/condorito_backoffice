import { ChevronDown, ChevronUp } from 'lucide-react';
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

function setNestedValue(
  source: unknown,
  path: string[],
  value: unknown,
): unknown {
  if (path.length === 0) return value;
  const [key, ...rest] = path;

  if (Array.isArray(source)) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0) return source;
    const next = [...source];
    next[index] = rest.length === 0
      ? value
      : setNestedValue(source[index], rest, value);
    return next;
  }

  const record = asRecord(source);
  if (rest.length === 0 && value === undefined) {
    const next = { ...record };
    delete next[key];
    return next;
  }
  return {
    ...record,
    [key]: rest.length === 0
      ? value
      : setNestedValue(record[key], rest, value),
  };
}

export function setValueAtPath(
  source: SchemaFormValue,
  path: string[],
  value: unknown,
): SchemaFormValue {
  return asRecord(setNestedValue(source, path, value));
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

export function moveArrayItem<T>(items: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) {
    return items;
  }
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function optionalObjectDefaults(schema: WidgetSchema): SchemaFormValue {
  const result: SchemaFormValue = {};
  for (const [key, property] of Object.entries(schema.properties ?? {})) {
    const value = defaultsFromSchema(property);
    if (value !== undefined) result[key] = value;
  }
  return result;
}

export function bindingPropertyApplies(schema: WidgetSchema, source: string): boolean {
  return !schema['x-binding-sources'] || schema['x-binding-sources'].includes(source);
}

export function changeDataBindingSource(
  value: unknown,
  source: string,
  schema?: WidgetSchema,
): SchemaFormValue {
  const next: SchemaFormValue = { ...asRecord(value), source };
  if (schema) {
    for (const [key, property] of Object.entries(schema.properties ?? {})) {
      if (key !== 'source' && !bindingPropertyApplies(property, source)) {
        delete next[key];
      }
    }
  } else if (source === 'continue_reading') {
    for (const key of ['containerId', 'limit', 'freeOnly', 'title']) delete next[key];
  } else if (source === 'comics' || source === 'container') {
    for (const key of ['freeOnly', 'title']) delete next[key];
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
    if (path.length > 0 && schema['x-optional']) {
      const enabled = value !== null && typeof value === 'object' && !Array.isArray(value);
      const enabledSchema = { ...schema };
      delete enabledSchema['x-optional'];
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
          {enabled && (
            <Field
              schema={enabledSchema}
              path={path}
              value={value}
              onChange={onChange}
              errors={errors}
              required={required}
            />
          )}
        </div>
      );
    }

    if (schema['x-control'] === 'data-binding') {
      const binding = asRecord(value);
      const properties = schema.properties ?? {};
      const schemaDefault = asRecord(schema.default);
      const firstSource = properties.source?.enum?.find(
        (option): option is string => typeof option === 'string',
      );
      const source = typeof binding.source === 'string'
        ? binding.source
        : typeof schemaDefault.source === 'string'
          ? schemaDefault.source
          : firstSource ?? '';
      const parameterEntries = Object.entries(properties).filter(
        ([key, property]) => key !== 'source' && bindingPropertyApplies(property, source),
      );
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
                  onChange(path, changeDataBindingSource(binding, nextSource, schema));
                } else {
                  onChange(sourcePath, nextSource);
                }
              }}
              errors={errors}
              required
            />
          )}
          {parameterEntries.map(([key, property]) => (
            <Field
              key={key}
              schema={property}
              path={[...path, key]}
              value={binding[key]}
              onChange={onChange}
              errors={errors}
              required={property['x-required-for-sources']?.includes(source)}
            />
          ))}
          {source === 'continue_reading' && (
            <div className="field-hint">
              Uses the signed-in user’s saved progress; no source parameters are required.
            </div>
          )}
          {source !== 'continue_reading' && parameterEntries.length === 0 && (
            <div className="field-hint">This source has no additional parameters.</div>
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
          checked={typeof value === 'boolean'
            ? value
            : typeof schema.default === 'boolean'
              ? schema.default
              : false}
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

  if (schema.type === 'array' && schema.items?.type === 'object') {
    const itemSchema = schema.items;
    const items = Array.isArray(value) ? value.map(asRecord) : [];
    const itemLabel = itemSchema.title ?? 'Item';
    const generatedDefault = defaultsFromSchema(itemSchema);
    const newItemDefault = asRecord(generatedDefault);

    return (
      <div className="field">
        <label>
          {label}
          {required && <span style={{ color: 'var(--primary)' }}> *</span>}
        </label>
        {schema.description && !error && <div className="field-hint">{schema.description}</div>}
        {error && <div className="field-hint" style={{ color: 'var(--error)' }}>{error}</div>}
        <div className="schema-array">
          {items.map((item, index) => {
            const itemPath = `${fieldPath}.${index}`;
            const itemError = errors[itemPath];
            return (
              <div className="schema-array-item" key={index}>
                <div className="schema-array-item-head">
                  <strong>{itemLabel} {index + 1}</strong>
                  <div className="schema-array-item-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      onClick={() => onChange(path, moveArrayItem(items, index, -1))}
                      disabled={index === 0}
                      aria-label={`Move ${itemLabel} ${index + 1} up`}
                      title="Move up"
                    >
                      <ChevronUp size={15} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      onClick={() => onChange(path, moveArrayItem(items, index, 1))}
                      disabled={index === items.length - 1}
                      aria-label={`Move ${itemLabel} ${index + 1} down`}
                      title="Move down"
                    >
                      <ChevronDown size={15} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => onChange(path, removeArrayItem(items, index))}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                {itemError && (
                  <div className="field-hint" style={{ color: 'var(--error)' }}>{itemError}</div>
                )}
                {Object.entries(itemSchema.properties ?? {}).map(([key, childSchema]) => (
                  <Field
                    key={key}
                    schema={childSchema}
                    path={[...path, String(index), key]}
                    value={item[key]}
                    onChange={onChange}
                    errors={errors}
                    required={itemSchema.required?.includes(key)}
                  />
                ))}
              </div>
            );
          })}
          <div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onChange(path, addArrayItem(items, newItemDefault))}
            >
              Add {itemLabel}
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
