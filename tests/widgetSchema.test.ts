import { describe, expect, it } from 'vitest';
import {
  addArrayItem,
  parseNumberInput,
  removeArrayItem,
  setValueAtPath,
  updateArrayItem,
} from '../src/components/WidgetSchemaForm';
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
const heroImage = WIDGETS.find((widget) => widget.type === 'hero-image');
if (!heroImage?.schema) throw new Error('Hero-image schema is required for these tests.');
const article = WIDGETS.find((widget) => widget.type === 'article');
if (!article?.schema) throw new Error('Article schema is required for these tests.');

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

  it('supports optional adaptive card and right-accessory fields', () => {
    expect(validateWidgetConfig(subHeader.schema, {
      title: 'Category',
      backgroundColor: '#FFDD00',
      characterAsset: 'character_condorito',
      showBell: false,
      tone: 'on-light',
      embedded: true,
    })).toEqual({});
    expect(validateWidgetConfig(subHeader.schema, {
      title: 'Category',
      tone: 'invalid',
    })).toHaveProperty('tone');
  });

  it('removes an optional schema value when it is reset', () => {
    expect(setValueAtPath(
      { title: 'Category', tone: 'on-light' },
      ['tone'],
      undefined,
    )).toEqual({ title: 'Category' });
  });

  it('keeps detail-header as a schema-compatible legacy catalog entry', () => {
    const legacy = WIDGETS.find((widget) => widget.type === 'detail-header');
    expect(legacy?.label).toContain('legacy');
    expect(legacy?.schema).toBe(subHeader.schema);
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

describe('hero-image schema form', () => {
  it('creates defaults for the asset and aspect ratio', () => {
    expect(defaultConfigForWidget(heroImage)).toEqual({
      asset: 'example-asset.svg',
      aspectRatio: 345 / 231,
    });
  });

  it('requires a non-empty asset and a positive aspect ratio', () => {
    expect(validateWidgetConfig(heroImage.schema, {
      asset: '',
      aspectRatio: 1.7,
    })).toHaveProperty('asset');
    expect(validateWidgetConfig(heroImage.schema, {
      asset: 'personajes-top-img',
      aspectRatio: 0,
    })).toHaveProperty('aspectRatio');
    expect(validateWidgetConfig(heroImage.schema, {
      asset: 'personajes-top-img',
      aspectRatio: 1.7,
    })).toEqual({});
  });

  it('parses number input while preserving empty and invalid in-progress values', () => {
    expect(parseNumberInput('1.7')).toBe(1.7);
    expect(parseNumberInput('0')).toBe(0);
    expect(parseNumberInput('')).toBe('');
    expect(parseNumberInput('not-a-number')).toBe('not-a-number');
  });
});

describe('article schema form', () => {
  it('creates the article body and ordered bullet defaults', () => {
    const defaults = defaultConfigForWidget(article);
    expect(defaults.body).toContain('Lorem ipsum');
    expect(defaults.bullets).toEqual([
      'bullet-1',
      'bullet-2',
      'bullet-3',
      'bullet-4',
    ]);
  });

  it('adds, updates, and removes primitive array items without reordering others', () => {
    const added = addArrayItem(['first', 'second'], 'third');
    expect(added).toEqual(['first', 'second', 'third']);

    const updated = updateArrayItem(added, 1, 'changed');
    expect(updated).toEqual(['first', 'changed', 'third']);

    expect(removeArrayItem(updated, 0)).toEqual(['changed', 'third']);
  });

  it('serializes the body translation while retaining its literal fallback', () => {
    const config = setTranslationKey(
      defaultConfigForWidget(article),
      'body',
      'personajes.article_body',
    );

    expect(normalizeTranslations(config)).toMatchObject({
      body: article.example.body,
      i18n: { body: 'personajes.article_body' },
    });
  });

  it('validates string bullet arrays', () => {
    expect(validateWidgetConfig(article.schema, {
      body: 'Article',
      bullets: ['one', 'two'],
    })).toEqual({});
    expect(validateWidgetConfig(article.schema, {
      body: 'Article',
      bullets: ['one', 2],
    })).toHaveProperty('bullets.1');
  });
});
