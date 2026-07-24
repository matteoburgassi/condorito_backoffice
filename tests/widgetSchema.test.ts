import { describe, expect, it } from 'vitest';
import { setValueAtPath } from '../src/components/WidgetSchemaForm';
import {
  WIDGETS,
  defaultConfigForWidget,
  defaultsFromSchema,
} from '../src/lib/widgetCatalog';
import {
  asWidgetConfig,
  normalizeTranslations,
  parseWidgetConfigJson,
  setTranslationKey,
  stringifyWidgetConfig,
  validateWidgetConfig,
} from '../src/lib/widgetSchema';

const subHeader = WIDGETS.find((widget) => widget.type === 'sub-header');
if (!subHeader?.schema) throw new Error('Sub-header schema is required for these tests.');

describe('sub-header schema form helpers', () => {
  it('recursively creates the starter configuration from schema defaults', () => {
    expect(defaultsFromSchema(subHeader.schema)).toEqual({
      title: 'Free Area',
      subtitle: 'Todos los contenidos GRATIS!',
      showBack: true,
    });
    expect(defaultConfigForWidget(subHeader)).toEqual(subHeader.example);
  });

  it('updates nested paths without losing unknown properties or false values', () => {
    const current = {
      title: 'Existing',
      showBack: false,
      custom: { preserved: true, value: 'old' },
    };

    const updated = setValueAtPath(current, ['custom', 'value'], '');

    expect(updated).toEqual({
      title: 'Existing',
      showBack: false,
      custom: { preserved: true, value: '' },
    });
  });

  it('hydrates an existing partial config without adding schema defaults', () => {
    const existing = { title: 'Stored title', custom: 'keep-me' };
    expect(asWidgetConfig(existing)).toEqual(existing);
  });

  it('serializes enabled translations and removes disabled or empty keys', () => {
    const translated = setTranslationKey(
      { title: 'Fallback' },
      'title',
      'screen.title',
    );
    expect(normalizeTranslations(translated)).toEqual({
      title: 'Fallback',
      i18n: { title: 'screen.title' },
    });

    const empty = setTranslationKey(translated, 'title', '  ');
    expect(normalizeTranslations(empty)).toEqual({ title: 'Fallback' });
  });

  it('maps required and minimum-length validation errors to the title field', () => {
    expect(validateWidgetConfig(subHeader.schema, {})).toHaveProperty('title');
    expect(validateWidgetConfig(subHeader.schema, { title: '' })).toHaveProperty('title');
    expect(validateWidgetConfig(subHeader.schema, { title: 'Valid' })).toEqual({});
  });

  it('round-trips advanced JSON without dropping custom fields', () => {
    const original = {
      title: 'Advanced',
      showBack: false,
      custom: { nested: ['value'] },
    };
    const result = parseWidgetConfigJson(stringifyWidgetConfig(original));

    expect(result.error).toBeUndefined();
    expect(result.config).toEqual(original);
  });

  it('rejects malformed and non-object advanced JSON', () => {
    expect(parseWidgetConfigJson('{')).toEqual({ error: 'Config must be valid JSON.' });
    expect(parseWidgetConfigJson('[]')).toEqual({ error: 'Config must be a JSON object.' });
  });
});
