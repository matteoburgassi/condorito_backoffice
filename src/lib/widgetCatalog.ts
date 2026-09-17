// Reference catalog for the data-driven screen composer. Mirrors the widget
// descriptor contract in the app (`src/lib/widget.types.ts`) and the data
// bindings the `condorito-screen` renderer understands. Used by the Help page
// (and can later drive a type picker in the section editor).

import { CATEGORY_ASSET_OPTIONS } from './resources';

export type BindingSupport = 'none' | 'items' | 'special';

export type WidgetSchema = {
  type: 'object' | 'string' | 'boolean' | 'number' | 'array';
  title?: string;
  description?: string;
  default?: unknown;
  enum?: Array<string | number>;
  minLength?: number;
  minItems?: number;
  minimum?: number;
  exclusiveMinimum?: number;
  properties?: Record<string, WidgetSchema>;
  required?: string[];
  items?: WidgetSchema;
  additionalProperties?: boolean;
  /** Optional generated-form control override for a schema primitive. */
  'x-control'?: 'textarea' | 'data-binding' | 'action';
  /** Object fields that must be explicitly enabled instead of emitted empty. */
  'x-optional'?: boolean;
  /** Marks literal string fields that can be overridden through config.i18n. */
  'x-translatable'?: boolean;
  /** Applies cross-field validation that cannot be expressed by this schema subset. */
  'x-validate'?: 'filter-spec' | 'filter-chip-items';
  /** Binding sources for which this data-binding property is visible. */
  'x-binding-sources'?: string[];
  /** Binding sources for which this property is required. */
  'x-required-for-sources'?: string[];
};

export type WidgetDoc = {
  type: string;
  label: string;
  description: string;
  binding: BindingSupport;
  /** data_binding sources that make sense for this widget. */
  sources: string[];
  /** Copy-paste starter config for a section of this type. */
  example: Record<string, unknown>;
  /** Runtime configuration contract used by the generated section form. */
  schema?: WidgetSchema;
  /** The Edge Function owns this widget's configuration; the Back Office edits only section metadata. */
  editor?: 'runtime-managed';
};

export type SourceDoc = {
  source: string;
  description: string;
  params: string;
  fills: string;
};

function cloneValue<T>(value: T): T {
  return value == null ? value : JSON.parse(JSON.stringify(value)) as T;
}

/** Recursively builds a starter value from JSON-schema defaults. */
export function defaultsFromSchema(schema: WidgetSchema): unknown {
  if (schema['x-optional']) return undefined;
  if (schema.default !== undefined) return cloneValue(schema.default);

  if (schema.type === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, property] of Object.entries(schema.properties ?? {})) {
      const value = defaultsFromSchema(property);
      if (value !== undefined) result[key] = value;
    }
    return result;
  }

  if (schema.type === 'array') return [];
  return undefined;
}

/** Schema defaults when available; legacy catalog examples otherwise. */
export function defaultConfigForWidget(widget: WidgetDoc): Record<string, unknown> {
  if (!widget.schema) return cloneValue(widget.example);
  return (defaultsFromSchema(widget.schema) ?? {}) as Record<string, unknown>;
}

export function widgetEditorMode(widget: WidgetDoc | undefined):
  | 'generated'
  | 'runtime-managed'
  | 'json' {
  if (widget?.editor === 'runtime-managed') return 'runtime-managed';
  return widget?.schema ? 'generated' : 'json';
}

const HEADER_ASSET_KEYS = [
  ...CATEGORY_ASSET_OPTIONS.map((option) => option.value),
  'condorito-1',
  'banner2-condorito',
  'banner1-comic',
  'banner1-chistes',
  'character_condorito',
];

const AUDIENCE_SCHEMA: WidgetSchema = {
  type: 'string',
  title: 'Audience',
  description: 'Optional client-side visibility rule.',
  enum: ['all', 'guest', 'logged_in', 'non_premium'],
};

const WIDGET_KEY_SCHEMA: WidgetSchema = {
  type: 'string',
  title: 'Widget key',
  description: 'Optional stable key used by client behavior and cross-widget references.',
};

const SHOW_TITLE_SCHEMA: WidgetSchema = {
  type: 'boolean',
  title: 'Show title',
  description: 'Hides the section title when disabled.',
  default: true,
};

function emptyMessageSchema(defaultValue: string): WidgetSchema {
  return {
    type: 'string',
    title: 'Empty message',
    description: 'Message displayed when the source returns no items.',
    default: defaultValue,
    minLength: 1,
    'x-translatable': true,
  };
}

const SUB_HEADER_SCHEMA: WidgetSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['title'],
  properties: {
    title: {
      type: 'string',
      title: 'Title',
      description: 'Main heading displayed by the sub-header.',
      default: 'Free Area',
      minLength: 1,
      'x-translatable': true,
    },
    subtitle: {
      type: 'string',
      title: 'Subtitle',
      description: 'Optional supporting text displayed below the title.',
      default: 'Todos los contenidos GRATIS!',
      'x-translatable': true,
    },
    audience: AUDIENCE_SCHEMA,
    showBack: {
      type: 'boolean',
      title: 'Show back button',
      description: 'Displays a back control on the left side.',
      default: true,
    },
    backgroundColor: {
      type: 'string',
      title: 'Background color',
      description: 'Optional card background color, for example #FFDD00.',
    },
    characterAsset: {
      type: 'string',
      title: 'Right-side character asset',
      description: 'Optional bundled character artwork key displayed on the right.',
      enum: HEADER_ASSET_KEYS,
    },
    showBell: {
      type: 'boolean',
      title: 'Show notification bell',
      description: 'Displays the subscription bell instead of character artwork.',
    },
    tone: {
      type: 'string',
      title: 'Text tone',
      description: 'Select on-light when using a light card background.',
      enum: ['on-dark', 'on-light'],
    },
    embedded: {
      type: 'boolean',
      title: 'Embedded spacing',
      description: 'Adds the category-detail top spacing without safe-area padding.',
    },
  },
};

const HERO_IMAGE_SCHEMA: WidgetSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['asset'],
  properties: {
    asset: {
      type: 'string',
      title: 'Asset',
      description: 'Bundled hero asset key rendered by the mobile app.',
      default: 'example-asset.svg',
      minLength: 1,
    },
    aspectRatio: {
      type: 'number',
      title: 'Aspect ratio',
      description: 'Image width divided by height.',
      default: 345 / 231,
      exclusiveMinimum: 0,
    },
    audience: AUDIENCE_SCHEMA,
  },
};

const ARTICLE_SCHEMA: WidgetSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    body: {
      type: 'string',
      title: 'Body',
      description: 'Main article text.',
      default: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua...',
      'x-control': 'textarea',
      'x-translatable': true,
    },
    bullets: {
      type: 'array',
      title: 'Bullets',
      description: 'Optional bullet points displayed after the body.',
      default: ['bullet-1', 'bullet-2', 'bullet-3', 'bullet-4'],
      items: {
        type: 'string',
        title: 'Bullet',
      },
    },
    audience: AUDIENCE_SCHEMA,
  },
};

const HEADER_ACTION_SCHEMA: WidgetSchema = {
  type: 'object',
  title: 'Header action',
  description: 'Optional action displayed beside the section title.',
  required: ['label', 'action'],
  additionalProperties: true,
  'x-optional': true,
  properties: {
    label: {
      type: 'string',
      title: 'Label',
      default: 'Ver todo',
      'x-translatable': true,
    },
    action: {
      type: 'object',
      title: 'Action',
      default: { type: 'navigate', route: '/colecciones' },
      required: ['type'],
      additionalProperties: true,
      'x-control': 'action',
      properties: {
        type: {
          type: 'string',
          title: 'Type',
          enum: ['navigate', 'open_webview', 'show_subscription', 'go_back', 'premium_gate'],
        },
        route: {
          type: 'string',
          title: 'Route',
        },
        url: {
          type: 'string',
          title: 'URL',
        },
      },
    },
  },
};

function jokeDataBindingSchema(defaultValue: Record<string, unknown>): WidgetSchema {
  return {
    type: 'object',
    title: 'Data source',
    description: 'Select the live source that fills joke items.',
    default: defaultValue,
    required: ['source'],
    additionalProperties: true,
    'x-control': 'data-binding',
    properties: {
      source: {
        type: 'string',
        title: 'Source',
        enum: ['jokes', 'container'],
      },
      containerId: {
        type: 'string',
        title: 'Container ID',
        'x-binding-sources': ['jokes', 'container'],
        'x-required-for-sources': ['container'],
      },
      limit: {
        type: 'number',
        title: 'Limit',
        minimum: 1,
        'x-binding-sources': ['jokes', 'container'],
      },
      freeOnly: {
        type: 'boolean',
        title: 'Free editions only',
        description: 'Jokes source only. Limits results to free editions.',
        'x-binding-sources': ['jokes'],
      },
      title: {
        type: 'string',
        title: 'Reader title fallback',
        description: 'Jokes source only. Used when an edition has no number.',
        'x-binding-sources': ['jokes'],
      },
    },
  };
}

const COMIC_CAROUSEL_SCHEMA: WidgetSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['title', 'emptyMessage', 'data_binding'],
  properties: {
    key: WIDGET_KEY_SCHEMA,
    title: {
      type: 'string',
      title: 'Title',
      description: 'Heading displayed above the carousel.',
      default: 'Comics',
      minLength: 1,
      'x-translatable': true,
    },
    emptyMessage: emptyMessageSchema('Sin comics disponibles'),
    variant: {
      type: 'string',
      title: 'Variant',
      description: 'Hero renders only the first item at full content width.',
      default: 'default',
      enum: ['default', 'continue-reading', 'hero'],
    },
    cardWidth: {
      type: 'number',
      title: 'Card width',
      description: 'Optional card width override in logical pixels.',
      exclusiveMinimum: 0,
    },
    cardHeight: {
      type: 'number',
      title: 'Card height',
      description: 'Optional card height override in logical pixels.',
      exclusiveMinimum: 0,
    },
    backgroundColor: {
      type: 'string',
      title: 'Background color',
      description: 'Optional section background color, for example #FDF5C4.',
    },
    audience: AUDIENCE_SCHEMA,
    data_binding: {
      type: 'object',
      title: 'Data source',
      description: 'Select the live source that fills carousel items.',
      default: { source: 'comics', limit: 6 },
      required: ['source'],
      additionalProperties: true,
      'x-control': 'data-binding',
      properties: {
        source: {
          type: 'string',
          title: 'Source',
          enum: ['comics', 'container', 'continue_reading'],
        },
        containerId: {
          type: 'string',
          title: 'Container ID',
          'x-binding-sources': ['comics', 'container'],
          'x-required-for-sources': ['container'],
        },
        limit: {
          type: 'number',
          title: 'Limit',
          minimum: 1,
          'x-binding-sources': ['comics', 'container'],
        },
      },
    },
    headerAction: HEADER_ACTION_SCHEMA,
  },
};

const JOKE_CAROUSEL_SCHEMA: WidgetSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['emptyMessage', 'data_binding'],
  properties: {
    key: WIDGET_KEY_SCHEMA,
    title: {
      type: 'string',
      title: 'Title',
      description: 'Optional heading displayed above the carousel.',
      default: 'Chistes',
      'x-translatable': true,
    },
    showTitle: SHOW_TITLE_SCHEMA,
    emptyMessage: emptyMessageSchema('Sin contenido disponible'),
    cardWidth: {
      type: 'number',
      title: 'Card width',
      description: 'Optional card width override. The app defaults to 110.',
      exclusiveMinimum: 0,
    },
    cardHeight: {
      type: 'number',
      title: 'Card height',
      description: 'Optional card height override. The app defaults to 155.',
      exclusiveMinimum: 0,
    },
    data_binding: jokeDataBindingSchema({ source: 'jokes', limit: 10 }),
    headerAction: HEADER_ACTION_SCHEMA,
  },
};

const COMIC_PANEL_SCHEMA: WidgetSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['emptyMessage', 'data_binding'],
  properties: {
    key: WIDGET_KEY_SCHEMA,
    title: {
      type: 'string',
      title: 'Title',
      description: 'Optional heading displayed above the panel.',
      default: 'Condoricosas',
      'x-translatable': true,
    },
    showTitle: SHOW_TITLE_SCHEMA,
    emptyMessage: emptyMessageSchema('Sin contenido disponible'),
    cardHeight: {
      type: 'number',
      title: 'Card height',
      description: 'Optional card height override. The app defaults to 155.',
      exclusiveMinimum: 0,
    },
    data_binding: jokeDataBindingSchema({
      source: 'container',
      containerId: 'jokes-condoricosas',
      limit: 10,
    }),
    headerAction: HEADER_ACTION_SCHEMA,
  },
};

function charactersDataBindingSchema(defaultValue: Record<string, unknown>): WidgetSchema {
  return {
    type: 'object',
    title: 'Data source',
    description: 'Character items are filled automatically.',
    default: defaultValue,
    required: ['source'],
    additionalProperties: true,
    'x-control': 'data-binding',
    properties: {
      source: {
        type: 'string',
        title: 'Source',
        enum: ['characters'],
      },
      limit: {
        type: 'number',
        title: 'Limit',
        minimum: 1,
        'x-binding-sources': ['characters'],
      },
    },
  };
}

const AVATAR_ROW_SCHEMA: WidgetSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['title', 'emptyMessage', 'data_binding'],
  properties: {
    key: WIDGET_KEY_SCHEMA,
    title: {
      type: 'string',
      title: 'Title',
      default: 'Acerca de Mí',
      minLength: 1,
      'x-translatable': true,
    },
    emptyMessage: emptyMessageSchema('Sin personajes'),
    data_binding: charactersDataBindingSchema({ source: 'characters', limit: 14 }),
    headerAction: HEADER_ACTION_SCHEMA,
  },
};

const GRID_SCHEMA: WidgetSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['title', 'emptyMessage', 'data_binding'],
  properties: {
    key: WIDGET_KEY_SCHEMA,
    title: {
      type: 'string',
      title: 'Title',
      default: 'PERSONAJES',
      minLength: 1,
      'x-translatable': true,
    },
    subtitle: {
      type: 'string',
      title: 'Subtitle',
      'x-translatable': true,
    },
    columns: {
      type: 'number',
      title: 'Columns',
      default: 2,
      minimum: 1,
    },
    emptyMessage: emptyMessageSchema('Sin personajes disponibles'),
    data_binding: charactersDataBindingSchema({ source: 'characters' }),
    headerAction: HEADER_ACTION_SCHEMA,
  },
};

const COMIC_LIST_SCHEMA: WidgetSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['variant', 'emptyMessage', 'data_binding'],
  properties: {
    key: {
      ...WIDGET_KEY_SCHEMA,
      description: 'Stable key required when this list is targeted by Filter Chips.',
    },
    variant: {
      type: 'string',
      title: 'Variant',
      default: 'tile',
      enum: ['tile', 'row'],
    },
    title: {
      type: 'string',
      title: 'Title',
      'x-translatable': true,
    },
    showTitle: SHOW_TITLE_SCHEMA,
    subtitle: {
      type: 'string',
      title: 'Subtitle',
      'x-translatable': true,
    },
    columns: {
      type: 'number',
      title: 'Columns',
      description: 'Used by the tile variant.',
      default: 2,
      minimum: 1,
    },
    emptyMessage: emptyMessageSchema('Sin resultados'),
    data_binding: {
      type: 'object',
      title: 'Data source',
      description: 'Select the live source that fills list items.',
      default: { source: 'comics' },
      required: ['source'],
      additionalProperties: true,
      'x-control': 'data-binding',
      properties: {
        source: {
          type: 'string',
          title: 'Source',
          enum: ['comics', 'container', 'wishlist'],
        },
        containerId: {
          type: 'string',
          title: 'Container ID',
          description: 'Optional for comics; required for a fixed container.',
          'x-binding-sources': ['comics', 'container'],
          'x-required-for-sources': ['container'],
        },
        limit: {
          type: 'number',
          title: 'Limit',
          minimum: 1,
          'x-binding-sources': ['comics', 'container'],
        },
      },
    },
    headerAction: HEADER_ACTION_SCHEMA,
  },
};

const CATEGORY_LIST_SCHEMA: WidgetSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['data_binding'],
  properties: {
    key: WIDGET_KEY_SCHEMA,
    sectionTitle: {
      type: 'string',
      title: 'Section title',
      default: 'SERIES',
      'x-translatable': true,
    },
    data_binding: {
      type: 'object',
      title: 'Data source',
      description: 'Collection category items are filled automatically.',
      default: { source: 'collection_categories' },
      required: ['source'],
      additionalProperties: true,
      'x-control': 'data-binding',
      properties: {
        source: {
          type: 'string',
          title: 'Source',
          enum: ['collection_categories'],
        },
      },
    },
  },
};

const INLINE_PDF_SCHEMA: WidgetSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['data_binding'],
  properties: {
    key: WIDGET_KEY_SCHEMA,
    title: {
      type: 'string',
      title: 'Title',
      default: 'Tira del Día',
      'x-translatable': true,
    },
    showTitle: SHOW_TITLE_SCHEMA,
    data_binding: {
      type: 'object',
      title: 'Data source',
      description: 'The PDF preview, aspect ratio and tap action are filled automatically.',
      default: { source: 'latest_strip' },
      required: ['source'],
      additionalProperties: true,
      'x-control': 'data-binding',
      properties: {
        source: {
          type: 'string',
          title: 'Source',
          enum: ['latest_strip'],
        },
        containerId: {
          type: 'string',
          title: 'Pulsar section reference',
          description: 'Optional. The app uses the daily-strip default when omitted.',
          'x-binding-sources': ['latest_strip'],
        },
      },
    },
    headerAction: HEADER_ACTION_SCHEMA,
  },
};

const STATIC_ITEM_ACTION_SCHEMA: WidgetSchema = {
  type: 'object',
  title: 'Tap action',
  description: 'Optional action triggered when this item is pressed.',
  required: ['type'],
  additionalProperties: true,
  'x-control': 'action',
  'x-optional': true,
  properties: {
    type: {
      type: 'string',
      title: 'Type',
      default: 'navigate',
      enum: ['navigate', 'open_webview', 'premium_gate'],
    },
    route: {
      type: 'string',
      title: 'Route',
      default: '/colecciones',
    },
    url: {
      type: 'string',
      title: 'URL',
    },
  },
};

const HORIZONTAL_CAROUSEL_SCHEMA: WidgetSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['emptyMessage', 'data_binding'],
  properties: {
    key: WIDGET_KEY_SCHEMA,
    title: {
      type: 'string',
      title: 'Title',
      default: 'Galería',
      'x-translatable': true,
    },
    showTitle: SHOW_TITLE_SCHEMA,
    emptyMessage: emptyMessageSchema('Sin imágenes'),
    cardWidth: {
      type: 'number',
      title: 'Card width',
      default: 240,
      exclusiveMinimum: 0,
    },
    cardHeight: {
      type: 'number',
      title: 'Card height',
      default: 160,
      exclusiveMinimum: 0,
    },
    data_binding: {
      type: 'object',
      title: 'Data source',
      description: 'Static items are stored directly in the section configuration.',
      default: {
        source: 'static',
        items: [{ key: '0', imageUrl: 'https://example.com/image.jpg' }],
      },
      required: ['source'],
      additionalProperties: true,
      'x-control': 'data-binding',
      properties: {
        source: {
          type: 'string',
          title: 'Source',
          enum: ['static'],
        },
        items: {
          type: 'array',
          title: 'Items',
          minItems: 1,
          'x-binding-sources': ['static'],
          'x-required-for-sources': ['static'],
          items: {
            type: 'object',
            title: 'Carousel item',
            required: ['key', 'imageUrl'],
            additionalProperties: true,
            properties: {
              key: {
                type: 'string',
                title: 'Key',
                default: 'new-item',
                minLength: 1,
              },
              imageUrl: {
                type: 'string',
                title: 'Image URL',
                default: 'https://example.com/image.jpg',
                minLength: 1,
              },
              action: STATIC_ITEM_ACTION_SCHEMA,
            },
          },
        },
      },
    },
    headerAction: HEADER_ACTION_SCHEMA,
  },
};

const CTA_ACTION_SCHEMA: WidgetSchema = {
  type: 'object',
  title: 'Call to action',
  required: ['type'],
  additionalProperties: true,
  'x-control': 'action',
  default: { type: 'navigate', route: '/colecciones' },
  properties: {
    type: {
      type: 'string',
      title: 'Type',
      enum: ['navigate', 'show_subscription', 'premium_gate'],
    },
    route: {
      type: 'string',
      title: 'Route',
    },
  },
};

const BANNER_ASSETS_SCHEMA: WidgetSchema = {
  type: 'object',
  title: 'Banner assets',
  description: 'Optional bundled artwork selected by stable registry key.',
  additionalProperties: true,
  'x-optional': true,
  properties: {
    pattern: {
      type: 'string',
      title: 'Background pattern',
      default: 'pattern_banner',
      enum: ['pattern_banner', 'pattern_banner2'],
    },
    character: {
      type: 'string',
      title: 'Character artwork',
      default: 'condorito-1',
      enum: ['condorito-1', 'banner2-condorito', 'subscription-condorito'],
    },
    topImage: {
      type: 'string',
      title: 'Subscription top image',
      description: 'Used by the subscription variant. Select none to hide it.',
      enum: ['subscribe-banner-comics', 'none'],
    },
  },
};

const BANNER_SCHEMA: WidgetSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['backgroundColor', 'title', 'ctaLabel', 'ctaAction'],
  properties: {
    key: WIDGET_KEY_SCHEMA,
    variant: {
      type: 'string',
      title: 'Layout variant',
      default: 'columns',
      enum: ['columns', 'stacked', 'subscription'],
    },
    assets: BANNER_ASSETS_SCHEMA,
    backgroundColor: {
      type: 'string',
      title: 'Background color',
      default: '#E8452D',
      minLength: 1,
    },
    title: {
      type: 'string',
      title: 'Title',
      default: '¡Nuevo!',
      minLength: 1,
      'x-translatable': true,
    },
    subtitle: {
      type: 'string',
      title: 'Subtitle',
      description: 'Supporting text, or the first label in the columns variant.',
      'x-translatable': true,
    },
    subtitle2: {
      type: 'string',
      title: 'Second column label',
      description: 'Used only by the columns variant.',
      'x-translatable': true,
    },
    ctaLabel: {
      type: 'string',
      title: 'Button label',
      default: 'Ver más',
      minLength: 1,
      'x-translatable': true,
    },
    ctaAction: CTA_ACTION_SCHEMA,
    audience: AUDIENCE_SCHEMA,
  },
};

const UPSELL_SCHEMA: WidgetSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['headline', 'subtitle', 'ctaLabel', 'ctaAction'],
  properties: {
    key: WIDGET_KEY_SCHEMA,
    headline: {
      type: 'string',
      title: 'Headline',
      default: 'Hazte premium',
      minLength: 1,
      'x-translatable': true,
    },
    subtitle: {
      type: 'string',
      title: 'Subtitle',
      default: 'Accede a todo el contenido',
      minLength: 1,
      'x-translatable': true,
    },
    ctaLabel: {
      type: 'string',
      title: 'Button label',
      default: 'Suscríbete',
      minLength: 1,
      'x-translatable': true,
    },
    ctaAction: {
      ...CTA_ACTION_SCHEMA,
      default: { type: 'show_subscription' },
    },
    condition: {
      type: 'string',
      title: 'Visibility condition',
      description: 'Hides this widget from premium subscribers.',
      default: 'not_premium',
      enum: ['not_premium'],
    },
  },
};

const SCREEN_HEADER_RIGHT_ACTION_SCHEMA: WidgetSchema = {
  type: 'object',
  title: 'Right action',
  description: 'Optional trailing action. Favorites may replace it with its edit control.',
  required: ['label', 'action'],
  additionalProperties: true,
  'x-optional': true,
  properties: {
    label: {
      type: 'string',
      title: 'Label',
      default: 'Ver todo',
      minLength: 1,
      'x-translatable': true,
    },
    icon: {
      type: 'string',
      title: 'Icon',
      enum: ['trash', 'close'],
    },
    action: {
      ...CTA_ACTION_SCHEMA,
      default: { type: 'navigate', route: '/colecciones' },
    },
  },
};

const SCREEN_HEADER_SCHEMA: WidgetSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['title'],
  properties: {
    key: WIDGET_KEY_SCHEMA,
    title: {
      type: 'string',
      title: 'Title',
      default: 'COLECCIONES',
      minLength: 1,
      'x-translatable': true,
    },
    subtitle: {
      type: 'string',
      title: 'Subtitle',
      'x-translatable': true,
    },
    showBack: {
      type: 'boolean',
      title: 'Show back button',
      default: false,
    },
    backRoute: {
      type: 'string',
      title: 'Back route',
      description: 'Optional fallback route for the back action.',
    },
    rightAction: SCREEN_HEADER_RIGHT_ACTION_SCHEMA,
    audience: AUDIENCE_SCHEMA,
  },
};

const SEARCH_BAR_SCHEMA: WidgetSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['placeholder', 'resultsRoute'],
  properties: {
    key: WIDGET_KEY_SCHEMA,
    placeholder: {
      type: 'string',
      title: 'Placeholder',
      default: 'Busca…',
      minLength: 1,
      'x-translatable': true,
    },
    resultsRoute: {
      type: 'string',
      title: 'Results route',
      description: 'Base route; the app appends the encoded search query.',
      default: '/colecciones/search',
      minLength: 1,
    },
  },
};

const PDF_READER_SCHEMA: WidgetSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['title', 'pdfUrl'],
  properties: {
    key: WIDGET_KEY_SCHEMA,
    title: {
      type: 'string',
      title: 'Title',
      default: 'Revista',
      minLength: 1,
    },
    pdfUrl: {
      type: 'string',
      title: 'PDF URL',
      default: 'https://example.com/comic.pdf',
      minLength: 1,
    },
    issueNumber: {
      type: 'number',
      title: 'Issue number',
      minimum: 1,
    },
    year: {
      type: 'number',
      title: 'Publication year',
      minimum: 1,
    },
    cmsId: {
      type: 'string',
      title: 'CMS content ID',
      description: 'Used for reading progress and wishlist integration.',
    },
  },
};

const FILTER_CHIPS_DEFAULT_ITEMS = [
  { key: 'all', label: 'Todos', filter: { kind: 'all' }, selected: true },
  { key: 'fav', label: 'Favoritos', filter: { kind: 'favorites' } },
  { key: '2020s', label: '2020s', filter: { kind: 'decade', from: 2020, to: 2029 } },
  { key: '1990s', label: '1990s', filter: { kind: 'decade', from: 1990, to: 1999 } },
];

const FILTER_SPEC_SCHEMA: WidgetSchema = {
  type: 'object',
  title: 'Filter',
  required: ['kind'],
  additionalProperties: true,
  'x-validate': 'filter-spec',
  properties: {
    kind: {
      type: 'string',
      title: 'Filter type',
      default: 'all',
      enum: ['all', 'favorites', 'decade'],
    },
    from: {
      type: 'number',
      title: 'From year',
      description: 'Required only for decade filters.',
    },
    to: {
      type: 'number',
      title: 'To year',
      description: 'Required only for decade filters.',
    },
  },
};

const FILTER_CHIP_ITEM_SCHEMA: WidgetSchema = {
  type: 'object',
  title: 'Filter chip',
  required: ['key', 'label', 'filter'],
  additionalProperties: true,
  properties: {
    key: {
      type: 'string',
      title: 'Key',
      description: 'Stable identifier unique within this filter row.',
      default: 'new-filter',
      minLength: 1,
    },
    label: {
      type: 'string',
      title: 'Label',
      default: 'New filter',
      minLength: 1,
    },
    selected: {
      type: 'boolean',
      title: 'Initially selected',
      description: 'At most one filter can be initially selected.',
    },
    filter: FILTER_SPEC_SCHEMA,
  },
};

const FILTER_CHIPS_SCHEMA: WidgetSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['targetKey', 'items'],
  properties: {
    key: {
      type: 'string',
      title: 'Widget key',
      description: 'Optional stable key for this filter row.',
    },
    targetKey: {
      type: 'string',
      title: 'Target widget key',
      description: 'Key of the comic-list section controlled by these filters.',
      default: 'category_comics',
      minLength: 1,
    },
    items: {
      type: 'array',
      title: 'Filters',
      description: 'Filters are evaluated in this order.',
      default: FILTER_CHIPS_DEFAULT_ITEMS,
      minItems: 1,
      items: FILTER_CHIP_ITEM_SCHEMA,
      'x-validate': 'filter-chip-items',
    },
  },
};

export const DATA_SOURCES: SourceDoc[] = [
  {
    source: 'comics',
    description: 'Comics from a fixed container, or from the current screen slug when containerId is omitted.',
    params: 'limit?, containerId? (defaults to route slug)',
    fills: 'items',
  },
  { source: 'jokes', description: 'Jokes / editions.', params: 'limit?, containerId?, freeOnly?, title?', fills: 'items' },
  {
    source: 'characters',
    description: 'Character profiles. Tap behavior is fixed by the widget type.',
    params: 'limit?',
    fills: 'items',
  },
  { source: 'container', description: 'Resolves a fixed container and returns its comics or jokes by content type.', params: 'containerId (required), limit?', fills: 'items' },
  {
    source: 'continue_reading',
    description: 'The signed-in user’s reading progress. Carousel defaults are supplied by the Edge Function.',
    params: '—',
    fills: 'items',
  },
  { source: 'collection_categories', description: 'Collection category tiles.', params: '—', fills: 'items' },
  { source: 'latest_strip', description: 'Latest “tira del día”; fills the preview fields of an inline-pdf.', params: 'containerId?', fills: 'pdfUrl, imageUrl, aspectRatio, action' },
  { source: 'static', description: 'Use the items you provide verbatim in the config.', params: 'items[]', fills: 'items' },
  { source: 'wishlist', description: 'The signed-in user’s saved comics and jokes.', params: '—', fills: 'items' },
];

export const WIDGETS: WidgetDoc[] = [
  {
    type: 'sub-header',
    label: 'Sub Header',
    description: 'Adaptive title/subtitle header with optional back button, card background and right-side accessory.',
    binding: 'none',
    sources: ['static'],
    schema: SUB_HEADER_SCHEMA,
    example: defaultsFromSchema(SUB_HEADER_SCHEMA) as Record<string, unknown>,
  },
  {
    type: 'hero-image',
    label: 'Hero Image',
    description: 'Hero image used as a header that renders a bundled asset',
    binding: 'none',
    sources: ['static'],
    schema: HERO_IMAGE_SCHEMA,
    example: defaultsFromSchema(HERO_IMAGE_SCHEMA) as Record<string, unknown>,
  },
  {
    type: 'article',
    label: 'Article',
    description: 'General purpose container for texts, with optional bullet points',
    binding: 'none',
    sources: ['static'],
    schema: ARTICLE_SCHEMA,
    example: defaultsFromSchema(ARTICLE_SCHEMA) as Record<string, unknown>,
  },
  {
    type: 'comic-carousel',
    label: 'Comic carousel',
    description: 'Horizontal rail of comic covers with issue/year and premium gating.',
    binding: 'items',
    sources: ['comics', 'container', 'continue_reading'],
    schema: COMIC_CAROUSEL_SCHEMA,
    example: defaultsFromSchema(COMIC_CAROUSEL_SCHEMA) as Record<string, unknown>,
  },
  {
    type: 'joke-carousel',
    label: 'Joke carousel',
    description: 'Horizontal rail of jokes / editions.',
    binding: 'items',
    sources: ['jokes', 'container'],
    schema: JOKE_CAROUSEL_SCHEMA,
    example: defaultsFromSchema(JOKE_CAROUSEL_SCHEMA) as Record<string, unknown>,
  },
  {
    type: 'comic-panel',
    label: 'Comic panel',
    description: 'Panel-style list, used for condoricosas.',
    binding: 'items',
    sources: ['jokes', 'container'],
    schema: COMIC_PANEL_SCHEMA,
    example: defaultsFromSchema(COMIC_PANEL_SCHEMA) as Record<string, unknown>,
  },
  {
    type: 'avatar-row',
    label: 'Avatar row',
    description: 'Round character avatars with names.',
    binding: 'items',
    sources: ['characters'],
    schema: AVATAR_ROW_SCHEMA,
    example: defaultsFromSchema(AVATAR_ROW_SCHEMA) as Record<string, unknown>,
  },
  {
    type: 'grid',
    label: 'Grid',
    description: 'Grid of items; when bound to characters shows a tappable detail.',
    binding: 'items',
    sources: ['characters'],
    schema: GRID_SCHEMA,
    example: defaultsFromSchema(GRID_SCHEMA) as Record<string, unknown>,
  },
  {
    type: 'comic-list',
    label: 'Comic list',
    description: 'Tile or row list of comics (with titles).',
    binding: 'items',
    sources: ['comics', 'container', 'wishlist'],
    schema: COMIC_LIST_SCHEMA,
    example: defaultsFromSchema(COMIC_LIST_SCHEMA) as Record<string, unknown>,
  },
  {
    type: 'category-list',
    label: 'Category list',
    description: 'Collection category tiles (series, etc.).',
    binding: 'items',
    sources: ['collection_categories'],
    schema: CATEGORY_LIST_SCHEMA,
    example: defaultsFromSchema(CATEGORY_LIST_SCHEMA) as Record<string, unknown>,
  },
  {
    type: 'inline-pdf',
    label: 'Inline PDF',
    description: 'Inline PDF preview (tira del día) that opens the reader on tap.',
    binding: 'special',
    sources: ['latest_strip'],
    schema: INLINE_PDF_SCHEMA,
    example: defaultsFromSchema(INLINE_PDF_SCHEMA) as Record<string, unknown>,
  },
  {
    type: 'horizontal-carousel',
    label: 'Horizontal carousel',
    description: 'Generic image rail (e.g. static panels).',
    binding: 'items',
    sources: ['static'],
    schema: HORIZONTAL_CAROUSEL_SCHEMA,
    example: defaultsFromSchema(HORIZONTAL_CAROUSEL_SCHEMA) as Record<string, unknown>,
  },
  {
    type: 'banner',
    label: 'Banner',
    description: 'Promotional banner with a title and call-to-action. Use audience to limit who sees it.',
    binding: 'none',
    sources: [],
    schema: BANNER_SCHEMA,
    example: defaultsFromSchema(BANNER_SCHEMA) as Record<string, unknown>,
  },
  {
    type: 'upsell',
    label: 'Upsell',
    description: 'Subscription upsell; hidden automatically for premium users.',
    binding: 'none',
    sources: [],
    schema: UPSELL_SCHEMA,
    example: defaultsFromSchema(UPSELL_SCHEMA) as Record<string, unknown>,
  },
  {
    type: 'screen-header',
    label: 'Screen header',
    description: 'Simple title/subtitle header.',
    binding: 'none',
    sources: [],
    schema: SCREEN_HEADER_SCHEMA,
    example: defaultsFromSchema(SCREEN_HEADER_SCHEMA) as Record<string, unknown>,
  },
  {
    type: 'detail-header',
    label: 'Detail header (legacy)',
    description: 'Legacy alias for Sub Header. Existing sections remain editable.',
    binding: 'none',
    sources: ['static'],
    schema: SUB_HEADER_SCHEMA,
    example: defaultsFromSchema(SUB_HEADER_SCHEMA) as Record<string, unknown>,
  },
  {
    type: 'search-bar',
    label: 'Search bar',
    description: 'Search input that routes to a results screen.',
    binding: 'none',
    sources: [],
    schema: SEARCH_BAR_SCHEMA,
    example: defaultsFromSchema(SEARCH_BAR_SCHEMA) as Record<string, unknown>,
  },
  {
    type: 'filter-chips',
    label: 'Filter chips',
    description: 'Filter chips that target another section on the same screen by key.',
    binding: 'none',
    sources: [],
    schema: FILTER_CHIPS_SCHEMA,
    example: defaultsFromSchema(FILTER_CHIPS_SCHEMA) as Record<string, unknown>,
  },
  {
    type: 'footer',
    label: 'Footer',
    description: 'Runtime-managed footer. Only section order and activation are editable here.',
    binding: 'none',
    sources: [],
    editor: 'runtime-managed',
    example: {},
  },
  {
    type: 'pdf-reader',
    label: 'PDF reader',
    description: 'Embedded PDF reader consumed only on comic-detail screens.',
    binding: 'none',
    sources: [],
    schema: PDF_READER_SCHEMA,
    example: defaultsFromSchema(PDF_READER_SCHEMA) as Record<string, unknown>,
  },
];

export const SECTION_AUDIENCES = [
  { value: 'all', label: 'Everyone' },
  { value: 'guest', label: 'Guests only (not logged in)' },
  { value: 'logged_in', label: 'Logged-in users only' },
  { value: 'non_premium', label: 'Non-premium (guests + free users)' },
] as const;

/** Ready-made banner sections for the screen composer (Area Libre + Subscribe). */
export const BANNER_PRESETS: Record<
  string,
  { label: string; type: string; config: Record<string, unknown> }
> = {
  area_libre: {
    label: 'Area Libre (free taste → /freemium)',
    type: 'banner',
    config: {
      key: 'home_area_libre',
      audience: 'guest',
      variant: 'columns',
      backgroundColor: '#007DBD',
      assets: { pattern: 'pattern_banner', character: 'condorito-1' },
      i18n: {
        title: 'home.area_libre',
        subtitle: 'home.comic',
        subtitle2: 'home.chistes',
        ctaLabel: 'home.lee_gratis',
      },
      title: 'Area Libre',
      subtitle: 'Comic',
      subtitle2: 'Chistes',
      ctaLabel: 'Lee Todo Gratis',
      ctaAction: { type: 'navigate', route: '/freemium' },
    },
  },
  subscribe: {
    label: 'Subscribe (Suscríbete)',
    type: 'banner',
    config: {
      key: 'suscribete_banner',
      audience: 'non_premium',
      variant: 'subscription',
      backgroundColor: '#E85D9F',
      assets: {
        pattern: 'pattern_banner2',
        character: 'banner2-condorito',
        topImage: 'subscribe-banner-comics',
      },
      i18n: {
        title: 'home.suscribete_banner_title',
        subtitle: 'home.suscribete_banner_subtitle',
        ctaLabel: 'home.suscribete_btn',
      },
      title: '¡Accede a toda la colección de cómics de Condorito!',
      subtitle: 'Suscríbete y lee sin límites',
      ctaLabel: 'Suscríbete Ahora',
      ctaAction: { type: 'show_subscription' },
    },
  },
  continue_reading: {
    label: 'Continua Leyendo (logged-in)',
    type: 'comic-carousel',
    config: {
      key: 'continua_leyendo',
      audience: 'logged_in',
      variant: 'continue-reading',
      backgroundColor: '#FDF5C4',
      i18n: { title: 'home.continua_leyendo' },
      title: 'Continua Leyendo',
      emptyMessage: 'Sin comics disponibles',
      headerAction: {
        label: '',
        action: { type: 'navigate', route: '/colecciones' },
      },
      data_binding: { source: 'continue_reading' },
    },
  },
};

export function widgetByType(type: string): WidgetDoc | undefined {
  return WIDGETS.find((w) => w.type === type);
}
