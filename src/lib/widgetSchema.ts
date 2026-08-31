import Ajv, { type ErrorObject } from 'ajv';
import type { WidgetSchema } from './widgetCatalog';

export type WidgetConfig = Record<string, unknown>;

const ajv = new Ajv({ allErrors: true, strict: false });

export function asWidgetConfig(value: unknown): WidgetConfig {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as WidgetConfig
    : {};
}

export function stringifyWidgetConfig(config: unknown): string {
  return JSON.stringify(config ?? {}, null, 2);
}

export function parseWidgetConfigJson(text: string):
  | { config: WidgetConfig; error?: never }
  | { config?: never; error: string } {
  try {
    const parsed = text.trim() === '' ? {} : JSON.parse(text);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { error: 'Config must be a JSON object.' };
    }
    return { config: parsed as WidgetConfig };
  } catch {
    return { error: 'Config must be valid JSON.' };
  }
}

function errorPath(error: ErrorObject): string {
  const path = error.instancePath
    .split('/')
    .filter(Boolean)
    .map((part) => part.split('~1').join('/').split('~0').join('~'))
    .join('.');

  if (error.keyword === 'required') {
    const missing = (error.params as { missingProperty?: string }).missingProperty;
    return [path, missing].filter(Boolean).join('.');
  }
  return path;
}

export function validateWidgetConfig(
  schema: WidgetSchema,
  config: WidgetConfig,
): Record<string, string> {
  const validate = ajv.compile(schema);
  const errors: Record<string, string> = {};
  if (!validate(config)) {
    for (const error of validate.errors ?? []) {
      const path = errorPath(error);
      if (!(path in errors)) errors[path] = error.message ?? 'Invalid value';
    }
  }

  function validateControls(currentSchema: WidgetSchema, value: unknown, path: string) {
    if (currentSchema.type === 'array') {
      const itemSchema = currentSchema.items;
      if (Array.isArray(value) && currentSchema['x-validate'] === 'filter-chip-items') {
        const seenKeys = new Set<string>();
        let hasSelectedItem = false;
        value.forEach((item, index) => {
          const record = asWidgetConfig(item);
          if (typeof record.key === 'string') {
            if (seenKeys.has(record.key)) {
              errors[`${path}.${index}.key`] = 'must be unique within this filter row';
            }
            seenKeys.add(record.key);
          }
          if (record.selected === true) {
            if (hasSelectedItem) {
              errors[`${path}.${index}.selected`] = 'only one filter can be initially selected';
            }
            hasSelectedItem = true;
          }
        });
      }
      if (Array.isArray(value) && itemSchema) {
        value.forEach((item, index) => {
          validateControls(
            itemSchema,
            item,
            path ? `${path}.${index}` : String(index),
          );
        });
      }
      return;
    }
    if (currentSchema.type !== 'object' || value === null || typeof value !== 'object' || Array.isArray(value)) {
      return;
    }
    const record = value as WidgetConfig;
    if (currentSchema['x-validate'] === 'filter-spec' && record.kind === 'decade') {
      const fromPath = `${path}.from`.replace(/^\./, '');
      const toPath = `${path}.to`.replace(/^\./, '');
      if (typeof record.from !== 'number' || !Number.isFinite(record.from)) {
        errors[fromPath] = 'is required for decade filters';
      }
      if (typeof record.to !== 'number' || !Number.isFinite(record.to)) {
        errors[toPath] = 'is required for decade filters';
      }
      if (
        typeof record.from === 'number'
        && typeof record.to === 'number'
        && record.from > record.to
      ) {
        errors[fromPath] = 'must be less than or equal to the ending year';
      }
    }
    if (currentSchema['x-control'] === 'data-binding') {
      if (record.source === 'container' && (
        typeof record.containerId !== 'string' || record.containerId.trim() === ''
      )) {
        errors[`${path}.containerId`.replace(/^\./, '')] = 'is required for the container source';
      }
    }
    if (currentSchema['x-control'] === 'action') {
      if (record.type === 'navigate' && (
        typeof record.route !== 'string' || record.route.trim() === ''
      )) {
        errors[`${path}.route`.replace(/^\./, '')] = 'is required for navigate actions';
      }
      if (record.type === 'open_webview' && (
        typeof record.url !== 'string' || record.url.trim() === ''
      )) {
        errors[`${path}.url`.replace(/^\./, '')] = 'is required for webview actions';
      }
    }
    for (const [key, property] of Object.entries(currentSchema.properties ?? {})) {
      validateControls(property, record[key], path ? `${path}.${key}` : key);
    }
  }

  validateControls(schema, config, '');
  return errors;
}

export function translatableProperties(schema: WidgetSchema) {
  if (schema.type !== 'object') return [];
  const fields: Array<{ key: string; property: WidgetSchema }> = [];

  function visit(current: WidgetSchema, prefix: string) {
    for (const [key, property] of Object.entries(current.properties ?? {})) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (property.type === 'string' && property['x-translatable']) {
        fields.push({ key: path, property });
      } else if (property.type === 'object') {
        visit(property, path);
      }
    }
  }

  visit(schema, '');
  return fields;
}

export function valueAtConfigPath(config: WidgetConfig, path: string): unknown {
  return path.split('.').reduce<unknown>((value, part) => (
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as WidgetConfig)[part]
      : undefined
  ), config);
}

export function setTranslationKey(
  config: WidgetConfig,
  property: string,
  key: string | undefined,
): WidgetConfig {
  const i18n = { ...asWidgetConfig(config.i18n) };
  if (key === undefined) delete i18n[property];
  else i18n[property] = key;

  const next = { ...config };
  if (Object.keys(i18n).length === 0) delete next.i18n;
  else next.i18n = i18n;
  return next;
}

export function normalizeTranslations(config: WidgetConfig): WidgetConfig {
  const rawI18n = asWidgetConfig(config.i18n);
  const i18n = Object.fromEntries(
    Object.entries(rawI18n)
      .filter(([, value]) => typeof value === 'string' && value.trim() !== '')
      .map(([key, value]) => [key, (value as string).trim()]),
  );

  const next = { ...config };
  if (Object.keys(i18n).length === 0) delete next.i18n;
  else next.i18n = i18n;
  return next;
}
