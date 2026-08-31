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

const COMIC_CAROUSEL_SCHEMA: WidgetSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['title', 'emptyMessage', 'data_binding'],
  properties: {
    key: {
      type: 'string',
      title: 'Widget key',
      description: 'Optional stable key used by filters and client behavior.',
    },
    title: {
      type: 'string',
      title: 'Title',
      description: 'Heading displayed above the carousel.',
      default: 'Comics',
      minLength: 1,
      'x-translatable': true,
    },
    emptyMessage: {
      type: 'string',
      title: 'Empty message',
      description: 'Message displayed when the source returns no items.',
      default: 'Sin comics disponibles',
      minLength: 1,
      'x-translatable': true,
    },
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
        },
        limit: {
          type: 'number',
          title: 'Limit',
          minimum: 1,
        },
      },
    },
    headerAction: {
      type: 'object',
      title: 'Header action',
      description: 'Optional action displayed beside the carousel title.',
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
    description: 'Character profiles. itemAction controls whether a tap navigates or opens the detail sheet.',
    params: 'limit?, itemAction? (navigate | show_detail), route? (navigate only)',
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
  { source: 'latest_strip', description: 'Latest “tira del día”; fills the PDF fields of an inline-pdf.', params: 'freeOnly?', fills: 'pdfUrl, aspectRatio, action' },
  { source: 'static', description: 'Use the items you provide verbatim in the config.', params: 'items[]', fills: 'items' },
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
    example: {
      title: 'Chistes',
      emptyMessage: 'Sin contenido disponible',
      data_binding: { source: 'jokes', limit: 10 },
    },
  },
  {
    type: 'comic-panel',
    label: 'Comic panel',
    description: 'Panel-style list, used for condoricosas.',
    binding: 'items',
    sources: ['jokes', 'container'],
    example: {
      title: 'Condoricosas',
      emptyMessage: 'Sin contenido disponible',
      data_binding: { source: 'container', containerId: 'jokes-condoricosas', limit: 10 },
    },
  },
  {
    type: 'avatar-row',
    label: 'Avatar row',
    description: 'Round character avatars with names.',
    binding: 'items',
    sources: ['characters'],
    example: {
      i18n: { title: 'home.acerca_de_mi' },
      title: 'Acerca de Mí',
      emptyMessage: 'Sin personajes',
      data_binding: {
        source: 'characters',
        limit: 14,
        itemAction: 'navigate',
        route: '/personajes',
      },
    },
  },
  {
    type: 'grid',
    label: 'Grid',
    description: 'Grid of items; when bound to characters shows a tappable detail.',
    binding: 'items',
    sources: ['characters'],
    example: {
      i18n: { title: 'personajes.titulo' },
      title: 'PERSONAJES',
      columns: 2,
      emptyMessage: 'Sin personajes disponibles',
      data_binding: { source: 'characters', itemAction: 'show_detail' },
    },
  },
  {
    type: 'comic-list',
    label: 'Comic list',
    description: 'Tile or row list of comics (with titles).',
    binding: 'items',
    sources: ['comics', 'container'],
    example: {
      variant: 'tile',
      columns: 2,
      emptyMessage: 'Sin resultados',
      data_binding: { source: 'comics' },
    },
  },
  {
    type: 'category-list',
    label: 'Category list',
    description: 'Collection category tiles (series, etc.).',
    binding: 'items',
    sources: ['collection_categories'],
    example: {
      i18n: { sectionTitle: 'colecciones.series' },
      sectionTitle: 'SERIES',
      data_binding: { source: 'collection_categories' },
    },
  },
  {
    type: 'inline-pdf',
    label: 'Inline PDF',
    description: 'Inline PDF preview (tira del día) that opens the reader on tap.',
    binding: 'special',
    sources: ['latest_strip'],
    example: {
      i18n: { title: 'home.tira_del_dia' },
      title: 'Tira del Día',
      data_binding: { source: 'latest_strip', freeOnly: true },
    },
  },
  {
    type: 'horizontal-carousel',
    label: 'Horizontal carousel',
    description: 'Generic image rail (e.g. static panels).',
    binding: 'items',
    sources: ['static'],
    example: {
      title: 'Galería',
      emptyMessage: 'Sin imágenes',
      cardWidth: 240,
      cardHeight: 160,
      data_binding: { source: 'static', items: [{ key: '0', imageUrl: 'https://…' }] },
    },
  },
  {
    type: 'banner',
    label: 'Banner',
    description: 'Promotional banner with a title and call-to-action. Use audience to limit who sees it.',
    binding: 'none',
    sources: [],
    example: {
      backgroundColor: '#E8452D',
      audience: 'all',
      i18n: { title: 'home.banner_title', ctaLabel: 'common.ver_mas' },
      title: '¡Nuevo!',
      ctaLabel: 'Ver más',
      ctaAction: { type: 'navigate', route: '/colecciones' },
    },
  },
  {
    type: 'upsell',
    label: 'Upsell',
    description: 'Subscription upsell; hidden automatically for premium users.',
    binding: 'none',
    sources: [],
    example: {
      headline: 'Hazte premium',
      subtitle: 'Accede a todo el contenido',
      ctaLabel: 'Suscríbete',
      ctaAction: { type: 'show_subscription' },
      condition: 'not_premium',
    },
  },
  {
    type: 'screen-header',
    label: 'Screen header',
    description: 'Simple title/subtitle header.',
    binding: 'none',
    sources: [],
    example: {
      i18n: {
        title: 'colecciones.titulo'
      },
      title: 'COLECCIONES'
    },
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
    example: { i18n: { placeholder: 'colecciones.buscar' }, placeholder: 'Busca…', resultsRoute: '/colecciones/search' },
  },
  {
    type: 'filter-chips',
    label: 'Filter chips',
    description: 'Filter chips that target another section on the same screen by key.',
    binding: 'none',
    sources: [],
    example: {
      targetKey: 'category_comics',
      items: [
        { key: 'all', label: 'Todos', filter: { kind: 'all' }, selected: true },
        { key: 'fav', label: 'Favoritos', filter: { kind: 'favorites' } },
      ],
    },
  },
  {
    type: 'footer',
    label: 'Footer',
    description: 'Footer links and copyright.',
    binding: 'none',
    sources: [],
    example: {
      items: [{ key: 'terms', label: 'Términos', action: { type: 'navigate', route: '/document?slug=cgu' } }],
      copyright: '2024 Condorito.',
    },
  },
  {
    type: 'pdf-reader',
    label: 'PDF reader',
    description: 'Embedded PDF reader for a specific comic.',
    binding: 'none',
    sources: [],
    example: { title: 'Revista', pdfUrl: 'https://…', issueNumber: 1, year: 2024 },
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
