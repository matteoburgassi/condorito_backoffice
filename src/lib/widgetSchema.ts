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
  if (validate(config)) return {};

  const errors: Record<string, string> = {};
  for (const error of validate.errors ?? []) {
    const path = errorPath(error);
    if (!(path in errors)) errors[path] = error.message ?? 'Invalid value';
  }
  return errors;
}

export function translatableProperties(schema: WidgetSchema) {
  if (schema.type !== 'object') return [];
  return Object.entries(schema.properties ?? {})
    .filter(([, property]) => property.type === 'string' && property['x-translatable'])
    .map(([key, property]) => ({ key, property }));
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
