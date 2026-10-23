import type { DataSource } from "../data-source.ts";
import type { Comic, ComicPanel, ComicStrip, Character, Joke, Container, CollectionCategory, Game } from "../types.ts";

const COLLECTION_CATEGORIES: CollectionCategory[] = [
  { id: "serie-regular", title: "SERIE REGULAR", subtitle: "desde 1955 hasta la actualidad", background_color: "#E91E8C", character_asset: "colecciones-serie-regular", sort_order: 1, is_visible: true, action_route: "/colecciones/category/serie-regular" },
  { id: "condorito-gigante", title: "CONDORITO GIGANTE", subtitle: "chistes de diversas épocas", background_color: "#1B2A4A", character_asset: "colecciones-condorito-gigante", sort_order: 2, is_visible: true, action_route: "/colecciones/category/condorito-gigante" },
  { id: "ediciones-especiales", title: "EDICIONES ESPECIALES", subtitle: "catalogados por título temático", background_color: "#1A8C7D", character_asset: "colecciones-ediciones-especiales", sort_order: 3, is_visible: true, action_route: "/colecciones/category/ediciones-especiales" },
  { id: "clasicos-pepo", title: "CLÁSICOS DE PEPO", subtitle: "catalogados por título temático", background_color: "#F5A623", character_asset: "colecciones-clasicos-de-pepo", sort_order: 4, is_visible: true, action_route: "/colecciones/category/clasicos-pepo" },
  { id: "chistes", title: "CHISTES", subtitle: "Humor rápido en 1 minuto", background_color: "#FFDD00", character_asset: "colecciones-chistes", sort_order: 5, is_visible: true, action_route: "/colecciones/category/chistes" },
  { id: "tira-del-dia", title: "TIRA DEL DÍA", subtitle: "Humor rápido en 1 minuto", background_color: "#0D6B5C", character_asset: "colecciones-tira-del-dia", sort_order: 6, is_visible: true, action_route: "/colecciones/category/tira-del-dia" },
];

const CONTAINERS: Container[] = [
  { id: "4113997", name: "Lo Mejor de la Semana", content_type: "comic", sort_order: 1, is_visible: true },
  { id: "jokes-chistes", name: "Chistes de fin de semana", content_type: "joke", sort_order: 2, is_visible: true },
  { id: "condoricosas", name: "Condoricosas", content_type: "condoricosa", sort_order: 3, is_visible: true },
];

const COMICS: Comic[] = [
  { id: "m1", title: "Revista Vintage - N 1", issue_number: 1, year: 1955, cover_image_url: "", description: "Primera edicion de la coleccion vintage de Condorito.", is_premium: false, pdf_url: "https://warehouse.galaxydve.com/content/7797879/7797879_source.pdf", container_id: "4113997", cms_id: "7797879", created_at: "2024-01-01T00:00:00Z" },
  { id: "m2", title: "Revista Cone - N 1", issue_number: 1, year: 2000, cover_image_url: "", description: "Primera edicion de la revista Cone.", is_premium: false, pdf_url: "https://warehouse.galaxydve.com/content/4048874/4048874_source.pdf", cms_id: "4048874", created_at: "2024-01-02T00:00:00Z" },
  { id: "m3", title: "Revista Condorito n 433", issue_number: 433, year: 2010, cover_image_url: "", description: "Edicion numero 433 de la revista Condorito.", is_premium: false, pdf_url: "https://warehouse.galaxydve.com/content/4633883/4633883_source.pdf", cms_id: "4633883", created_at: "2024-01-03T00:00:00Z" },
];

const CHARACTERS: Character[] = [
  { id: "mc1", name: "Condorito", slug: "condorito", description: "El protagonista", avatar_image_url: "https://images.pexels.com/photos/1661179/pexels-photo-1661179.jpeg?auto=compress&cs=tinysrgb&w=200", bio: "Un condor humanizado que vive en Pelotillehue, conocido por su ingenio y sus aventuras.", sort_order: 1 },
  { id: "mc2", name: "Cone", slug: "cone", description: "El sobrino", avatar_image_url: "https://images.pexels.com/photos/1661179/pexels-photo-1661179.jpeg?auto=compress&cs=tinysrgb&w=200", bio: "Sobrino de Condorito, siempre dispuesto a ayudar.", sort_order: 2 },
  { id: "mc3", name: "Yayita", slug: "yayita", description: "La novia", avatar_image_url: "https://images.pexels.com/photos/1661179/pexels-photo-1661179.jpeg?auto=compress&cs=tinysrgb&w=200", bio: "La eterna novia de Condorito, bella y elegante.", sort_order: 3 },
  { id: "mc4", name: "Don Chuma", slug: "don-chuma", description: "El suegro", avatar_image_url: "https://images.pexels.com/photos/1661179/pexels-photo-1661179.jpeg?auto=compress&cs=tinysrgb&w=200", bio: "Padre de Yayita, siempre desaprobando a Condorito.", sort_order: 4 },
  { id: "mc5", name: "Pepe Cortisona", slug: "pepe", description: "El amigo", avatar_image_url: "https://images.pexels.com/photos/1661179/pexels-photo-1661179.jpeg?auto=compress&cs=tinysrgb&w=200", bio: "Mejor amigo de Condorito, companero de aventuras.", sort_order: 5 },
  { id: "mc6", name: "Huevo Duro", slug: "huevoduro", description: "El matoncito", avatar_image_url: "https://images.pexels.com/photos/1661179/pexels-photo-1661179.jpeg?auto=compress&cs=tinysrgb&w=200", bio: "El bravucon del barrio que siempre busca pelea.", sort_order: 6 },
];

const JOKES: Joke[] = [
  { id: "mj1", image_url: "", text_content: "Chiste N 1", is_free: true, pdf_url: "https://warehouse.galaxydve.com/content/4759779/4759779_source.pdf", edition_number: 1, container_id: "jokes-chistes", created_at: "2024-01-01T00:00:00Z" },
  { id: "mj2", image_url: "", text_content: "Chiste N 2", is_free: true, pdf_url: "https://warehouse.galaxydve.com/content/4759779/4759779_source.pdf", edition_number: 2, container_id: "jokes-chistes", created_at: "2024-01-02T00:00:00Z" },
  { id: "mj3", image_url: "", text_content: "Chiste N 3", is_free: true, pdf_url: "https://warehouse.galaxydve.com/content/4759779/4759779_source.pdf", edition_number: 3, container_id: "jokes-chistes", created_at: "2024-01-03T00:00:00Z" },
  { id: "mj4", image_url: "", text_content: "Chiste N 4", is_free: false, pdf_url: "https://warehouse.galaxydve.com/content/4759779/4759779_source.pdf", edition_number: 4, container_id: "jokes-chistes", created_at: "2024-01-04T00:00:00Z" },
  { id: "mj5", image_url: "", text_content: "Chiste N 5", is_free: true, pdf_url: "https://warehouse.galaxydve.com/content/4759779/4759779_source.pdf", edition_number: 5, container_id: "jokes-chistes", created_at: "2024-01-05T00:00:00Z" },
  { id: "mj6", image_url: "", text_content: "Condoricosa N 1", is_free: true, pdf_url: "https://warehouse.galaxydve.com/content/5555874/5555874_source.pdf", edition_number: 1, container_id: "condoricosas", created_at: "2024-02-01T00:00:00Z" },
  { id: "mj7", image_url: "", text_content: "Condoricosa N 2", is_free: true, pdf_url: "https://warehouse.galaxydve.com/content/1739725/1739725_source.pdf", edition_number: 2, container_id: "condoricosas", created_at: "2024-02-02T00:00:00Z" },
  { id: "mj8", image_url: "", text_content: "Condoricosa N 3", is_free: true, pdf_url: "https://warehouse.galaxydve.com/content/5555874/5555874_source.pdf", edition_number: 3, container_id: "condoricosas", created_at: "2024-02-03T00:00:00Z" },
  { id: "mj9", image_url: "", text_content: "Condoricosa N 4", is_free: false, pdf_url: "https://warehouse.galaxydve.com/content/1739725/1739725_source.pdf", edition_number: 4, container_id: "condoricosas", created_at: "2024-02-04T00:00:00Z" },
  { id: "mj10", image_url: "", text_content: "Condoricosa N 5", is_free: true, pdf_url: "https://warehouse.galaxydve.com/content/5555874/5555874_source.pdf", edition_number: 5, container_id: "condoricosas", created_at: "2024-02-05T00:00:00Z" },
];

const GAMES: Game[] = [
  { id: "g1", title: "Condorito Runner", cover_image_url: "https://images.pexels.com/photos/442576/pexels-photo-442576.jpeg?auto=compress&cs=tinysrgb&w=400", game_url: "https://www.google.com/webhp", description: "Corre con Condorito." },
  { id: "g2", title: "Puzzle Condorito", cover_image_url: "https://images.pexels.com/photos/3471423/pexels-photo-3471423.jpeg?auto=compress&cs=tinysrgb&w=400", game_url: "https://www.google.com/webhp", description: "Arma el puzzle." },
  { id: "g3", title: "Trivia Condorito", cover_image_url: "https://images.pexels.com/photos/1438081/pexels-photo-1438081.jpeg?auto=compress&cs=tinysrgb&w=400", game_url: "https://www.google.com/webhp", description: "Pon a prueba tu conocimiento." },
  { id: "g4", title: "Colorea a Condorito", cover_image_url: "https://images.pexels.com/photos/1148998/pexels-photo-1148998.jpeg?auto=compress&cs=tinysrgb&w=400", game_url: "https://www.google.com/webhp", description: "Dale color a tus personajes." },
];

const STRIPS: ComicStrip[] = [
  {
    id: "ms1",
    title: "Tira del Dia",
    panels: [
      { order: 1, image_url: "https://images.pexels.com/photos/3394939/pexels-photo-3394939.jpeg?auto=compress&cs=tinysrgb&w=600" },
      { order: 2, image_url: "https://images.pexels.com/photos/3394939/pexels-photo-3394939.jpeg?auto=compress&cs=tinysrgb&w=600" },
      { order: 3, image_url: "https://images.pexels.com/photos/3394939/pexels-photo-3394939.jpeg?auto=compress&cs=tinysrgb&w=600" },
    ],
    published_date: "2024-06-29T00:00:00Z",
    is_free: true,
  },
];

export class MockSource implements DataSource {
  async getCollectionCategories(): Promise<CollectionCategory[]> {
    return COLLECTION_CATEGORIES.filter((c) => c.is_visible).sort((a, b) => a.sort_order - b.sort_order);
  }

  async getContainers(options?: { contentType?: string }): Promise<Container[]> {
    let result = CONTAINERS.filter((c) => c.is_visible);
    if (options?.contentType) result = result.filter((c) => c.content_type === options.contentType);
    return result.sort((a, b) => a.sort_order - b.sort_order);
  }

  async getComics(options?: { limit?: number; offset?: number; containerId?: string }): Promise<Comic[]> {
    let comics = COMICS;
    if (options?.containerId) {
      comics = comics.filter((c) => c.container_id === options.containerId);
    }
    const start = options?.offset ?? 0;
    const sliced = options?.limit ? comics.slice(start, start + options.limit) : comics.slice(start);
    return sliced;
  }

  async getComicById(id: string): Promise<{ comic: Comic; panels: ComicPanel[] } | null> {
    const comic = COMICS.find((c) => c.id === id);
    if (!comic) return null;
    const panels: ComicPanel[] = comic.pdf_url
      ? []
      : Array.from({ length: 6 }, (_, i) => ({
          order: i + 1,
          image_url: comic.cover_image_url,
        }));
    return { comic, panels };
  }

  async getStrips(options?: {
    freeOnly?: boolean;
    limit?: number;
    containerId?: string;
  }): Promise<ComicStrip[]> {
    let result = STRIPS;
    if (options?.freeOnly) result = result.filter((s) => s.is_free);
    if (options?.limit) result = result.slice(0, options.limit);
    return result;
  }

  async getLatestStrip(options?: {
    freeOnly?: boolean;
    containerId?: string;
  }): Promise<ComicStrip | null> {
    const strips = await this.getStrips({ freeOnly: options?.freeOnly, limit: 1 });
    return strips[0] ?? null;
  }

  async getCharacters(options?: { limit?: number }): Promise<Character[]> {
    return options?.limit ? CHARACTERS.slice(0, options.limit) : CHARACTERS;
  }

  async getCharacterById(id: string): Promise<Character | null> {
    return CHARACTERS.find((c) => c.id === id) ?? null;
  }

  async getJokes(options?: { freeOnly?: boolean; limit?: number; containerId?: string }): Promise<Joke[]> {
    let result = [...JOKES];
    if (options?.containerId) result = result.filter((j) => j.container_id === options.containerId);
    if (options?.freeOnly) result = result.filter((j) => j.is_free);
    if (options?.limit) result = result.slice(0, options.limit);
    return result;
  }

  async getGames(options?: { limit?: number }): Promise<Game[]> {
    return options?.limit ? GAMES.slice(0, options.limit) : GAMES;
  }
}
