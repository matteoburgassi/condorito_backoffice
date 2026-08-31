import { describe, expect, it } from 'vitest';
import {
  addArrayItem,
  bindingPropertyApplies,
  changeActionType,
  changeDataBindingSource,
  moveArrayItem,
  optionalObjectDefaults,
  parseNumberInput,
  removeArrayItem,
  setValueAtPath,
  updateArrayItem,
} from '../src/components/WidgetSchemaForm';
import {
  BANNER_PRESETS,
  WIDGETS,
  defaultConfigForWidget,
  defaultsFromSchema,
  widgetEditorMode,
  type WidgetSchema,
} from '../src/lib/widgetCatalog';
import {
  asWidgetConfig,
  normalizeTranslations,
  parseWidgetConfigJson,
  setTranslationKey,
  stringifyWidgetConfig,
  translatableProperties,
  validateWidgetConfig,
  valueAtConfigPath,
} from '../src/lib/widgetSchema';
import { CATEGORY_ASSET_OPTIONS, RESOURCES } from '../src/lib/resources';

const subHeader = WIDGETS.find((widget) => widget.type === 'sub-header');
if (!subHeader?.schema) throw new Error('Sub-header schema is required for these tests.');
const heroImage = WIDGETS.find((widget) => widget.type === 'hero-image');
if (!heroImage?.schema) throw new Error('Hero-image schema is required for these tests.');
const article = WIDGETS.find((widget) => widget.type === 'article');
if (!article?.schema) throw new Error('Article schema is required for these tests.');
const comicCarousel = WIDGETS.find((widget) => widget.type === 'comic-carousel');
if (!comicCarousel?.schema) throw new Error('Comic-carousel schema is required for these tests.');
const jokeCarousel = WIDGETS.find((widget) => widget.type === 'joke-carousel');
if (!jokeCarousel?.schema) throw new Error('Joke-carousel schema is required for these tests.');
const comicPanel = WIDGETS.find((widget) => widget.type === 'comic-panel');
if (!comicPanel?.schema) throw new Error('Comic-panel schema is required for these tests.');
const detailHeader = WIDGETS.find((widget) => widget.type === 'detail-header');
if (!detailHeader?.schema) throw new Error('Detail-header schema is required for these tests.');
const filterChips = WIDGETS.find((widget) => widget.type === 'filter-chips');
if (!filterChips?.schema) throw new Error('Filter-chips schema is required for these tests.');

const advancedFormWidgets = [
  subHeader,
  detailHeader,
  heroImage,
  article,
  comicCarousel,
];

describe('advanced-form widget audiences', () => {
  it.each(advancedFormWidgets)(
    'exposes the supported audiences for $type without adding a default',
    (widget) => {
      expect(widget.schema.properties?.audience).toMatchObject({
        type: 'string',
        enum: ['all', 'guest', 'logged_in', 'non_premium'],
      });
      expect(defaultConfigForWidget(widget)).not.toHaveProperty('audience');
    },
  );

  it.each(advancedFormWidgets)(
    'validates audience values for $type',
    (widget) => {
      const defaults = defaultConfigForWidget(widget);
      expect(validateWidgetConfig(widget.schema, {
        ...defaults,
        audience: 'logged_in',
      })).toEqual({});
      expect(validateWidgetConfig(widget.schema, {
        ...defaults,
        audience: 'members',
      })).toHaveProperty('audience');
    },
  );
});

describe('object-array form helpers', () => {
  it('updates nested array paths without dropping sibling or unknown properties', () => {
    const current = {
      items: [{
        key: 'all',
        custom: 'preserved',
        filter: { kind: 'all', customFilter: true },
      }],
    };

    expect(setValueAtPath(current, ['items', '0', 'filter', 'kind'], 'decade')).toEqual({
      items: [{
        key: 'all',
        custom: 'preserved',
        filter: { kind: 'decade', customFilter: true },
      }],
    });
  });

  it('moves array items while preserving order and safely handling boundaries', () => {
    const items = ['all', 'favorites', '2020s'];
    expect(moveArrayItem(items, 1, -1)).toEqual(['favorites', 'all', '2020s']);
    expect(moveArrayItem(items, 1, 1)).toEqual(['all', '2020s', 'favorites']);
    expect(moveArrayItem(items, 0, -1)).toBe(items);
    expect(moveArrayItem(items, items.length - 1, 1)).toBe(items);
  });

  it('creates a complete default object for newly added filter items', () => {
    const itemSchema = filterChips.schema.properties?.items?.items;
    if (!itemSchema) throw new Error('Filter-chip item schema is required.');

    const newItem = defaultsFromSchema(itemSchema);
    expect(newItem).toEqual({
      key: 'new-filter',
      label: 'New filter',
      filter: { kind: 'all' },
    });
    const added = addArrayItem<Record<string, unknown>>([], newItem as Record<string, unknown>);
    expect(added).toEqual([newItem]);
    expect(removeArrayItem(added, 0)).toEqual([]);
  });

  it('validates controls nested inside object arrays with indexed paths', () => {
    const schema: WidgetSchema = {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              action: {
                type: 'object',
                'x-control': 'action',
                properties: {
                  type: { type: 'string' },
                  route: { type: 'string' },
                },
              },
            },
          },
        },
      },
    };

    expect(validateWidgetConfig(schema, {
      items: [{ action: { type: 'navigate' } }],
    })).toHaveProperty('items.0.action.route');
  });
});

describe('filter-chips schema form', () => {
  it('creates the production-aligned starter configuration', () => {
    const defaults = defaultConfigForWidget(filterChips);
    expect(defaults).toEqual(filterChips.example);
    expect(defaults).toMatchObject({
      targetKey: 'category_comics',
      items: [
        { key: 'all', filter: { kind: 'all' }, selected: true },
        { key: 'fav', filter: { kind: 'favorites' } },
        { key: '2020s', filter: { kind: 'decade', from: 2020, to: 2029 } },
        { key: '1990s', filter: { kind: 'decade', from: 1990, to: 1999 } },
      ],
    });
    expect(validateWidgetConfig(filterChips.schema, defaults)).toEqual({});
  });

  it('accepts all supported filter shapes', () => {
    expect(validateWidgetConfig(filterChips.schema, {
      targetKey: 'category_comics',
      items: [
        { key: 'all', label: 'Todos', filter: { kind: 'all' } },
        { key: 'fav', label: 'Favoritos', filter: { kind: 'favorites' } },
        { key: '1980s', label: '1980s', filter: { kind: 'decade', from: 1980, to: 1989 } },
      ],
    })).toEqual({});
  });

  it('rejects missing or reversed decade bounds with indexed errors', () => {
    expect(validateWidgetConfig(filterChips.schema, {
      targetKey: 'category_comics',
      items: [
        { key: 'missing', label: 'Missing', filter: { kind: 'decade' } },
        { key: 'reversed', label: 'Reversed', filter: { kind: 'decade', from: 2029, to: 2020 } },
      ],
    })).toMatchObject({
      'items.0.filter.from': expect.any(String),
      'items.0.filter.to': expect.any(String),
      'items.1.filter.from': expect.any(String),
    });
  });

  it('rejects empty lists, duplicate keys, and multiple initial selections', () => {
    expect(validateWidgetConfig(filterChips.schema, {
      targetKey: 'category_comics',
      items: [],
    })).toHaveProperty('items');

    expect(validateWidgetConfig(filterChips.schema, {
      targetKey: 'category_comics',
      items: [
        { key: 'same', label: 'First', selected: true, filter: { kind: 'all' } },
        { key: 'same', label: 'Second', selected: true, filter: { kind: 'favorites' } },
      ],
    })).toMatchObject({
      'items.1.key': expect.any(String),
      'items.1.selected': expect.any(String),
    });
  });
});

describe('joke widget schema forms', () => {
  it('creates valid source-specific starter configurations', () => {
    expect(defaultConfigForWidget(jokeCarousel)).toEqual({
      title: 'Chistes',
      showTitle: true,
      emptyMessage: 'Sin contenido disponible',
      data_binding: { source: 'jokes', limit: 10 },
    });
    expect(defaultConfigForWidget(comicPanel)).toEqual({
      title: 'Condoricosas',
      showTitle: true,
      emptyMessage: 'Sin contenido disponible',
      data_binding: {
        source: 'container',
        containerId: 'jokes-condoricosas',
        limit: 10,
      },
    });
    expect(validateWidgetConfig(
      jokeCarousel.schema,
      defaultConfigForWidget(jokeCarousel),
    )).toEqual({});
    expect(validateWidgetConfig(
      comicPanel.schema,
      defaultConfigForWidget(comicPanel),
    )).toEqual({});
  });

  it.each([jokeCarousel, comicPanel])(
    'supports jokes and container bindings for $type',
    (widget) => {
      const binding = widget.schema.properties?.data_binding;
      expect(binding?.properties?.source.enum).toEqual(['jokes', 'container']);
      expect(validateWidgetConfig(widget.schema, {
        ...defaultConfigForWidget(widget),
        data_binding: { source: 'jokes', limit: 10, freeOnly: true, title: 'Chiste' },
      })).toEqual({});
      expect(validateWidgetConfig(widget.schema, {
        ...defaultConfigForWidget(widget),
        data_binding: { source: 'container', limit: 10 },
      })).toHaveProperty('data_binding.containerId');
      expect(validateWidgetConfig(widget.schema, {
        ...defaultConfigForWidget(widget),
        data_binding: { source: 'container', containerId: 'condoricosas_2', limit: 10 },
      })).toEqual({});
    },
  );

  it('cleans known source-specific fields while preserving custom binding data', () => {
    const binding = {
      source: 'jokes',
      containerId: 'chistes',
      limit: 10,
      freeOnly: true,
      title: 'Chiste',
      custom: 'preserved',
    };
    expect(changeDataBindingSource(binding, 'container')).toEqual({
      source: 'container',
      containerId: 'chistes',
      limit: 10,
      custom: 'preserved',
    });
    expect(changeDataBindingSource(binding, 'continue_reading')).toEqual({
      source: 'continue_reading',
      custom: 'preserved',
    });
  });

  it('validates widget-specific positive dimensions', () => {
    expect(jokeCarousel.schema.properties).toHaveProperty('cardWidth');
    expect(comicPanel.schema.properties).not.toHaveProperty('cardWidth');
    expect(validateWidgetConfig(jokeCarousel.schema, {
      ...defaultConfigForWidget(jokeCarousel),
      cardWidth: 0,
      cardHeight: -1,
    })).toMatchObject({
      cardWidth: expect.any(String),
      cardHeight: expect.any(String),
    });
    expect(validateWidgetConfig(comicPanel.schema, {
      ...defaultConfigForWidget(comicPanel),
      cardHeight: 0,
    })).toHaveProperty('cardHeight');
  });

  it.each([jokeCarousel, comicPanel])(
    'supports validated optional header actions for $type',
    (widget) => {
      const headerActionSchema = widget.schema.properties?.headerAction;
      if (!headerActionSchema) throw new Error('Header action schema is required.');
      const headerAction = optionalObjectDefaults(headerActionSchema);
      expect(headerAction).toEqual({
        label: 'Ver todo',
        action: { type: 'navigate', route: '/colecciones' },
      });
      expect(validateWidgetConfig(widget.schema, {
        ...defaultConfigForWidget(widget),
        headerAction,
      })).toEqual({});
      expect(validateWidgetConfig(widget.schema, {
        ...defaultConfigForWidget(widget),
        headerAction: {
          label: 'Open',
          action: { type: 'navigate' },
        },
      })).toHaveProperty('headerAction.action.route');
    },
  );

  it.each([jokeCarousel, comicPanel])(
    'exposes translations without audience or static items for $type',
    (widget) => {
      expect(translatableProperties(widget.schema).map(({ key }) => key)).toEqual([
        'title',
        'emptyMessage',
        'headerAction.label',
      ]);
      expect(widget.schema.properties).not.toHaveProperty('audience');
      expect(widget.schema.properties).not.toHaveProperty('items');
      expect(widget.schema.properties?.data_binding?.properties).not.toHaveProperty('items');
    },
  );
});

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

describe('category asset configuration', () => {
  it('offers the bundled category assets in resources and sub-header forms', () => {
    const categoryResource = RESOURCES.find((resource) => resource.key === 'collection-categories');
    const assetField = categoryResource?.fields.find((field) => field.name === 'character_asset');
    const assetKeys = CATEGORY_ASSET_OPTIONS.map((option) => option.value);
    const subHeaderAsset = subHeader.schema.properties?.characterAsset;

    expect(assetField).toMatchObject({
      type: 'select',
      options: CATEGORY_ASSET_OPTIONS,
    });
    expect(subHeaderAsset?.enum).toEqual(expect.arrayContaining(assetKeys));
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

describe('comic-carousel schema form', () => {
  it('creates a live comics starter without optional overrides', () => {
    expect(defaultConfigForWidget(comicCarousel)).toEqual({
      title: 'Comics',
      emptyMessage: 'Sin comics disponibles',
      variant: 'default',
      data_binding: { source: 'comics', limit: 6 },
    });
  });

  it('validates variants, audiences, and positive card dimensions', () => {
    const defaults = defaultConfigForWidget(comicCarousel);
    expect(validateWidgetConfig(comicCarousel.schema, {
      ...defaults,
      variant: 'hero',
      audience: 'logged_in',
      cardWidth: 200,
      cardHeight: 280,
    })).toEqual({});
    expect(validateWidgetConfig(comicCarousel.schema, {
      ...defaults,
      variant: 'unknown',
      audience: 'members',
      cardWidth: 0,
    })).toMatchObject({
      variant: expect.any(String),
      audience: expect.any(String),
      cardWidth: expect.any(String),
    });
  });

  it('enforces source-specific binding fields', () => {
    const defaults = defaultConfigForWidget(comicCarousel);
    expect(validateWidgetConfig(comicCarousel.schema, {
      ...defaults,
      data_binding: { source: 'container', limit: 6 },
    })).toHaveProperty('data_binding.containerId');
    expect(validateWidgetConfig(comicCarousel.schema, {
      ...defaults,
      data_binding: { source: 'container', containerId: 'series-condorito' },
    })).toEqual({});
    expect(validateWidgetConfig(comicCarousel.schema, {
      ...defaults,
      data_binding: { source: 'continue_reading' },
    })).toEqual({});
  });

  it('changes binding sources without dropping unknown fields', () => {
    const current = {
      source: 'comics',
      limit: 8,
      containerId: 'old',
      custom: 'preserved',
    };
    expect(changeDataBindingSource(current, 'continue_reading')).toEqual({
      source: 'continue_reading',
      custom: 'preserved',
    });
    expect(changeDataBindingSource(current, 'container')).toEqual({
      ...current,
      source: 'container',
    });
  });

  it('enables an optional header action with valid defaults', () => {
    const headerActionSchema = comicCarousel.schema.properties?.headerAction;
    if (!headerActionSchema) throw new Error('Header action schema is required.');

    const headerAction = optionalObjectDefaults(headerActionSchema);
    expect(headerAction).toEqual({
      label: 'Ver todo',
      action: { type: 'navigate', route: '/colecciones' },
    });
    expect(validateWidgetConfig(comicCarousel.schema, {
      ...defaultConfigForWidget(comicCarousel),
      headerAction,
    })).toEqual({});
  });

  it('keeps the existing continue-reading preset schema-valid', () => {
    expect(validateWidgetConfig(
      comicCarousel.schema,
      BANNER_PRESETS.continue_reading.config,
    )).toEqual({});
  });

  it('shows only fields relevant to the selected action and validates them', () => {
    expect(changeActionType(
      { type: 'navigate', route: '/colecciones', custom: true },
      'open_webview',
    )).toEqual({ type: 'open_webview', custom: true });

    const defaults = defaultConfigForWidget(comicCarousel);
    expect(validateWidgetConfig(comicCarousel.schema, {
      ...defaults,
      headerAction: {
        label: 'Open',
        action: { type: 'navigate' },
      },
    })).toHaveProperty('headerAction.action.route');
    expect(validateWidgetConfig(comicCarousel.schema, {
      ...defaults,
      headerAction: {
        label: 'Open',
        action: { type: 'open_webview' },
      },
    })).toHaveProperty('headerAction.action.url');
  });

  it('serializes top-level and nested translation keys', () => {
    const headerActionSchema = comicCarousel.schema.properties?.headerAction;
    if (!headerActionSchema) throw new Error('Header action schema is required.');
    const withAction = {
      ...defaultConfigForWidget(comicCarousel),
      headerAction: optionalObjectDefaults(headerActionSchema),
    };
    const translated = setTranslationKey(
      setTranslationKey(withAction, 'title', 'home.comics'),
      'headerAction.label',
      'home.ver_todo',
    );

    expect(translatableProperties(comicCarousel.schema).map(({ key }) => key)).toEqual([
      'title',
      'emptyMessage',
      'headerAction.label',
    ]);
    expect(valueAtConfigPath(translated, 'headerAction.label')).toBe('Ver todo');
    expect(normalizeTranslations(translated)).toMatchObject({
      i18n: {
        title: 'home.comics',
        'headerAction.label': 'home.ver_todo',
      },
    });
  });

  it('round-trips advanced carousel JSON with custom fields', () => {
    const original = {
      ...defaultConfigForWidget(comicCarousel),
      custom: { layoutExperiment: true },
      data_binding: { source: 'comics', limit: 12, customParam: 'keep' },
    };
    expect(parseWidgetConfigJson(stringifyWidgetConfig(original))).toEqual({
      config: original,
    });
  });
});

describe('complete widget catalog forms', () => {
  const newlyGeneratedTypes = [
    'avatar-row',
    'grid',
    'comic-list',
    'category-list',
    'inline-pdf',
    'horizontal-carousel',
    'banner',
    'upsell',
    'screen-header',
    'search-bar',
    'pdf-reader',
  ];

  function generatedWidget(type: string) {
    const widget = WIDGETS.find((candidate) => candidate.type === type);
    if (!widget?.schema) throw new Error(`${type} must have a generated schema.`);
    return { ...widget, schema: widget.schema };
  }

  it('gives every catalog widget an explicit editor mode', () => {
    expect(WIDGETS.filter(
      (widget) => widgetEditorMode(widget) === 'json',
    )).toEqual([]);
    expect(WIDGETS.filter(
      (widget) => widgetEditorMode(widget) === 'runtime-managed',
    ).map((widget) => widget.type)).toEqual(['footer']);
  });

  it.each(newlyGeneratedTypes)('creates valid defaults for %s', (type) => {
    const widget = generatedWidget(type);
    const defaults = defaultConfigForWidget(widget);
    expect(defaults).toEqual(widget.example);
    expect(validateWidgetConfig(widget.schema, defaults)).toEqual({});
  });

  it.each(newlyGeneratedTypes)('enforces every declared required field for %s', (type) => {
    const widget = generatedWidget(type);
    const defaults = defaultConfigForWidget(widget);
    for (const requiredField of widget.schema.required ?? []) {
      const incomplete = { ...defaults };
      delete incomplete[requiredField];
      expect(validateWidgetConfig(widget.schema, incomplete)).toHaveProperty(requiredField);
    }
  });

  it('keeps character binding controls limited to supported runtime fields', () => {
    for (const type of ['avatar-row', 'grid']) {
      const binding = generatedWidget(type).schema.properties?.data_binding;
      expect(binding?.properties).toHaveProperty('limit');
      expect(binding?.properties).not.toHaveProperty('itemAction');
      expect(binding?.properties).not.toHaveProperty('route');
    }
  });

  it('validates comics, fixed-container, and Wishlist list bindings', () => {
    const widget = generatedWidget('comic-list');
    const binding = widget.schema.properties?.data_binding;
    expect(binding?.properties?.source.enum).toEqual(['comics', 'container', 'wishlist']);
    expect(validateWidgetConfig(widget.schema, {
      ...defaultConfigForWidget(widget),
      data_binding: { source: 'wishlist' },
    })).toEqual({});
    expect(validateWidgetConfig(widget.schema, {
      ...defaultConfigForWidget(widget),
      data_binding: { source: 'container' },
    })).toHaveProperty('data_binding.containerId');
  });

  it('declares and cleans binding parameters through schema metadata', () => {
    const widget = generatedWidget('comic-list');
    const binding = widget.schema.properties?.data_binding;
    if (!binding) throw new Error('Comic-list binding schema is required.');
    const containerId = binding.properties?.containerId;
    const limit = binding.properties?.limit;
    if (!containerId || !limit) throw new Error('Binding parameter schemas are required.');

    expect(bindingPropertyApplies(containerId, 'container')).toBe(true);
    expect(bindingPropertyApplies(containerId, 'wishlist')).toBe(false);
    expect(bindingPropertyApplies(limit, 'comics')).toBe(true);
    expect(changeDataBindingSource({
      source: 'container',
      containerId: 'series',
      limit: 8,
      custom: 'preserved',
    }, 'wishlist', binding)).toEqual({
      source: 'wishlist',
      custom: 'preserved',
    });
  });

  it('omits fields that are generated or ignored at runtime', () => {
    const comicList = generatedWidget('comic-list').schema.properties;
    const categoryList = generatedWidget('category-list').schema.properties;
    const inlinePdf = generatedWidget('inline-pdf').schema.properties;

    expect(comicList).not.toHaveProperty('editing');
    expect(comicList).not.toHaveProperty('items');
    expect(categoryList).not.toHaveProperty('items');
    expect(inlinePdf).not.toHaveProperty('pdfUrl');
    expect(inlinePdf).not.toHaveProperty('imageUrl');
    expect(inlinePdf).not.toHaveProperty('aspectRatio');
    expect(inlinePdf).not.toHaveProperty('action');
    expect(inlinePdf?.data_binding?.properties).not.toHaveProperty('freeOnly');
  });

  it('edits static carousel object arrays and validates nested actions', () => {
    const widget = generatedWidget('horizontal-carousel');
    const defaults = defaultConfigForWidget(widget);
    expect(defaults).toMatchObject({
      showTitle: true,
      cardWidth: 240,
      cardHeight: 160,
      data_binding: {
        source: 'static',
        items: [{ key: '0', imageUrl: expect.any(String) }],
      },
    });
    expect(validateWidgetConfig(widget.schema, {
      ...defaults,
      data_binding: { source: 'static', items: [] },
    })).toHaveProperty('data_binding.items');
    expect(validateWidgetConfig(widget.schema, {
      ...defaults,
      data_binding: {
        source: 'static',
        items: [{ key: 'one', imageUrl: 'https://example.com/one.jpg', action: { type: 'navigate' } }],
      },
    })).toHaveProperty('data_binding.items.0.action.route');
  });

  it('preserves and validates both production banner presets', () => {
    const widget = generatedWidget('banner');
    for (const preset of [BANNER_PRESETS.area_libre, BANNER_PRESETS.subscribe]) {
      expect(validateWidgetConfig(widget.schema, preset.config)).toEqual({});
    }
    expect(widget.schema.properties?.variant?.enum).toEqual([
      'columns',
      'stacked',
      'subscription',
    ]);
    expect(widget.schema.properties?.assets?.properties?.topImage?.enum).toContain(
      'subscribe-banner-comics',
    );
    expect(widget.schema.properties).toHaveProperty('audience');
  });

  it('keeps static-widget controls aligned with their runtime contracts', () => {
    const upsell = generatedWidget('upsell');
    const screenHeader = generatedWidget('screen-header');
    const searchBar = generatedWidget('search-bar');
    const pdfReader = generatedWidget('pdf-reader');

    expect(upsell.schema.properties?.condition?.enum).toEqual(['not_premium']);
    expect(upsell.schema.properties).not.toHaveProperty('audience');
    expect(screenHeader.schema.properties).toHaveProperty('audience');
    expect(screenHeader.schema.properties).toHaveProperty('rightAction');
    expect(validateWidgetConfig(searchBar.schema, {
      placeholder: 'Buscar',
      resultsRoute: '',
    })).toHaveProperty('resultsRoute');
    expect(pdfReader.schema.properties).toHaveProperty('cmsId');
    expect(translatableProperties(pdfReader.schema)).toEqual([]);
  });

  it('validates presentation enums, dimensions, and context-specific actions', () => {
    const grid = generatedWidget('grid');
    const comicList = generatedWidget('comic-list');
    const carousel = generatedWidget('horizontal-carousel');
    const banner = generatedWidget('banner');
    const upsell = generatedWidget('upsell');
    const screenHeader = generatedWidget('screen-header');

    expect(validateWidgetConfig(grid.schema, {
      ...defaultConfigForWidget(grid),
      columns: 0,
    })).toHaveProperty('columns');
    expect(validateWidgetConfig(comicList.schema, {
      ...defaultConfigForWidget(comicList),
      variant: 'cards',
    })).toHaveProperty('variant');
    expect(validateWidgetConfig(carousel.schema, {
      ...defaultConfigForWidget(carousel),
      cardWidth: 0,
      cardHeight: -1,
    })).toMatchObject({
      cardWidth: expect.any(String),
      cardHeight: expect.any(String),
    });
    expect(validateWidgetConfig(banner.schema, {
      ...defaultConfigForWidget(banner),
      ctaAction: { type: 'sign_out' },
    })).toHaveProperty('ctaAction.type');
    expect(validateWidgetConfig(upsell.schema, {
      ...defaultConfigForWidget(upsell),
      condition: 'guest',
    })).toHaveProperty('condition');

    const rightActionSchema = screenHeader.schema.properties?.rightAction;
    if (!rightActionSchema) throw new Error('Screen-header right action schema is required.');
    expect(validateWidgetConfig(screenHeader.schema, {
      ...defaultConfigForWidget(screenHeader),
      rightAction: optionalObjectDefaults(rightActionSchema),
    })).toEqual({});
  });

  it('exposes translation controls only for runtime-translated copy', () => {
    expect(translatableProperties(generatedWidget('avatar-row').schema).map(({ key }) => key))
      .toEqual(['title', 'emptyMessage', 'headerAction.label']);
    expect(translatableProperties(generatedWidget('banner').schema).map(({ key }) => key))
      .toEqual(['title', 'subtitle', 'subtitle2', 'ctaLabel']);
    expect(translatableProperties(generatedWidget('upsell').schema).map(({ key }) => key))
      .toEqual(['headline', 'subtitle', 'ctaLabel']);
    expect(translatableProperties(generatedWidget('screen-header').schema).map(({ key }) => key))
      .toEqual(['title', 'subtitle', 'rightAction.label']);
  });

  it('marks Footer as runtime-managed and preserves stored config verbatim', () => {
    const footer = WIDGETS.find((widget) => widget.type === 'footer');
    expect(widgetEditorMode(footer)).toBe('runtime-managed');
    expect(footer?.schema).toBeUndefined();
    expect(defaultConfigForWidget(footer!)).toEqual({});

    const stored = {
      key: 'legacy-footer',
      items: [{ key: 'terms', custom: true }],
      copyright: 'Preserve me',
    };
    expect(parseWidgetConfigJson(stringifyWidgetConfig(stored))).toEqual({
      config: stored,
    });
  });

  it.each(newlyGeneratedTypes)(
    'round-trips unknown Advanced JSON properties for %s',
    (type) => {
      const widget = generatedWidget(type);
      const original = {
        ...defaultConfigForWidget(widget),
        custom: { experiment: type },
      };
      expect(parseWidgetConfigJson(stringifyWidgetConfig(original))).toEqual({
        config: original,
      });
    },
  );
});
