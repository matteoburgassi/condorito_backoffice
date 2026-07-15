// Reference catalog for the data-driven screen composer. Mirrors the widget
// descriptor contract in the app (`src/lib/widget.types.ts`) and the data
// bindings the `condorito-screen` renderer understands. Used by the Help page
// (and can later drive a type picker in the section editor).

export type BindingSupport = 'none' | 'items' | 'special';

export type WidgetDoc = {
  type: string;
  label: string;
  description: string;
  binding: BindingSupport;
  /** data_binding sources that make sense for this widget. */
  sources: string[];
  /** Copy-paste starter config for a section of this type. */
  example: Record<string, unknown>;
};

export type SourceDoc = {
  source: string;
  description: string;
  params: string;
  fills: string;
};

export const DATA_SOURCES: SourceDoc[] = [
  { source: 'comics', description: 'Comics from the catalogue.', params: 'limit?, containerId?', fills: 'items' },
  { source: 'jokes', description: 'Jokes / editions.', params: 'limit?, containerId?, freeOnly?, title?', fills: 'items' },
  { source: 'characters', description: 'Character profiles.', params: 'limit?', fills: 'items' },
  { source: 'container', description: 'Resolves a container and returns its comics or jokes by content type.', params: 'containerId (required), limit?', fills: 'items' },
  { source: 'continue_reading', description: 'The signed-in user’s reading progress (empty for guests).', params: '—', fills: 'items' },
  { source: 'collection_categories', description: 'Collection category tiles.', params: '—', fills: 'items' },
  { source: 'latest_strip', description: 'Latest “tira del día”; fills the PDF fields of an inline-pdf.', params: 'freeOnly?', fills: 'pdfUrl, aspectRatio, action' },
  { source: 'static', description: 'Use the items you provide verbatim in the config.', params: 'items[]', fills: 'items' },
];

export const WIDGETS: WidgetDoc[] = [
  {
    type: 'comic-carousel',
    label: 'Comic carousel',
    description: 'Horizontal rail of comic covers with issue/year and premium gating.',
    binding: 'items',
    sources: ['comics', 'container', 'continue_reading'],
    example: {
      i18n: { title: 'home.ver_todo' },
      title: 'Comics',
      emptyMessage: 'Sin comics disponibles',
      data_binding: { source: 'comics', limit: 6 },
    },
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
      data_binding: { source: 'characters', limit: 10 },
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
      data_binding: { source: 'characters' },
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
    description: 'Promotional banner with a title and call-to-action. Static (no binding).',
    binding: 'none',
    sources: [],
    example: {
      backgroundColor: '#E8452D',
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
    example: { i18n: { title: 'colecciones.titulo' }, title: 'COLECCIONES' },
  },
  {
    type: 'detail-header',
    label: 'Detail header',
    description: 'Header with back/bell, background color and optional character art.',
    binding: 'none',
    sources: [],
    example: {
      title: 'RESULTADOS',
      backgroundColor: '#FFDD00',
      showBack: true,
      showBell: true,
      tone: 'on-light',
    },
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
