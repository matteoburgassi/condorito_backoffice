import type { DataSource } from "../data-source.ts";
import type { Comic, ComicPanel, ComicStrip, Character, Joke, Container, CollectionCategory, Game } from "../types.ts";

const GALAXY_BASE_URL = Deno.env.get("GALAXY_BASE_URL") || "";
const GALAXY_API_KEY = Deno.env.get("GALAXY_API_KEY") || "";

function resolveMediaUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const cdnBase = Deno.env.get("GALAXY_CDN_BASE_URL") || GALAXY_BASE_URL;
  return `${cdnBase}/${path.replace(/^\//, "")}`;
}

async function galaxyFetch<T>(endpoint: string): Promise<T> {
  if (!GALAXY_BASE_URL) {
    throw new Error("GALAXY_BASE_URL not configured");
  }
  const res = await fetch(`${GALAXY_BASE_URL}${endpoint}`, {
    headers: {
      "Authorization": `Bearer ${GALAXY_API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Galaxy API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

const MOCK_COLLECTION_CATEGORIES: CollectionCategory[] = [
  { id: "serie-regular", title: "SERIE REGULAR", subtitle: "desde 1955 hasta la actualidad", background_color: "#E91E8C", character_asset: "colecciones-serie-regular", sort_order: 1, is_visible: true, action_route: "/colecciones/category/serie-regular" },
  { id: "condorito-gigante", title: "CONDORITO GIGANTE", subtitle: "chistes de diversas épocas", background_color: "#1B2A4A", character_asset: "colecciones-condorito-gigante", sort_order: 2, is_visible: true, action_route: "/colecciones/category/condorito-gigante" },
  { id: "ediciones-especiales", title: "EDICIONES ESPECIALES", subtitle: "catalogados por título temático", background_color: "#1A8C7D", character_asset: "colecciones-ediciones-especiales", sort_order: 3, is_visible: true, action_route: "/colecciones/category/ediciones-especiales" },
  { id: "clasicos-pepo", title: "CLÁSICOS DE PEPO", subtitle: "catalogados por título temático", background_color: "#F5A623", character_asset: "colecciones-clasicos-de-pepo", sort_order: 4, is_visible: true, action_route: "/colecciones/category/clasicos-pepo" },
  { id: "chistes", title: "CHISTES", subtitle: "Humor rápido en 1 minuto", background_color: "#FFDD00", character_asset: "colecciones-chistes", sort_order: 5, is_visible: true, action_route: "/colecciones/category/chistes" },
  { id: "tira-del-dia", title: "TIRA DEL DÍA", subtitle: "Humor rápido en 1 minuto", background_color: "#0D6B5C", character_asset: "colecciones-tira-del-dia", sort_order: 6, is_visible: true, action_route: "/colecciones/category/tira-del-dia" },
];

const MOCK_CONTAINERS: Container[] = [
  { id: "4113997", name: "Lo Mejor de la Semana", content_type: "comic", sort_order: 1, is_visible: true },
  { id: "jokes-condoricosas", name: "Condoricosas", content_type: "joke", sort_order: 2, is_visible: true },
];

const MOCK_COMICS: Comic[] = [
  { id: "g1", title: "Revista Vintage - N 1", issue_number: 1, year: 1955, cover_image_url: "", description: "Primera edicion de la coleccion vintage de Condorito.", is_premium: false, pdf_url: "https://warehouse.galaxydve.com/content/7797879/7797879_source.pdf", container_id: "4113997", created_at: "2024-01-01T00:00:00Z" },
  { id: "g2", title: "Revista Cone - N 1", issue_number: 1, year: 2000, cover_image_url: "", description: "Primera edicion de la revista Cone.", is_premium: false, pdf_url: "https://warehouse.galaxydve.com/content/4048874/4048874_source.pdf", created_at: "2024-01-02T00:00:00Z" },
  { id: "g3", title: "Revista Condorito n 433", issue_number: 433, year: 2010, cover_image_url: "", description: "Edicion numero 433 de la revista Condorito.", is_premium: false, pdf_url: "https://warehouse.galaxydve.com/content/4633883/4633883_source.pdf", created_at: "2024-01-03T00:00:00Z" },
];

const MOCK_CHARACTERS: Character[] = [
  { id: "gc1", name: "Condorito", slug: "condorito", description: "El protagonista", avatar_image_url: "https://images.pexels.com/photos/1661179/pexels-photo-1661179.jpeg?auto=compress&cs=tinysrgb&w=200", bio: "Un condor humanizado", sort_order: 1 },
  { id: "gc2", name: "Cone", slug: "cone", description: "El sobrino", avatar_image_url: "https://images.pexels.com/photos/1661179/pexels-photo-1661179.jpeg?auto=compress&cs=tinysrgb&w=200", bio: "Sobrino de Condorito", sort_order: 2 },
];

const MOCK_JOKES: Joke[] = [
  { id: "gj1", image_url: "", text_content: "Condoricosa N 1", is_free: true, pdf_url: "https://warehouse.galaxydve.com/content/4759779/4759779_source.pdf", edition_number: 1, container_id: "jokes-condoricosas", created_at: "2024-01-01T00:00:00Z" },
  { id: "gj2", image_url: "", text_content: "Condoricosa N 2", is_free: true, pdf_url: "https://warehouse.galaxydve.com/content/4759779/4759779_source.pdf", edition_number: 2, container_id: "jokes-condoricosas", created_at: "2024-01-02T00:00:00Z" },
  { id: "gj3", image_url: "", text_content: "Condoricosa N 3", is_free: false, pdf_url: "https://warehouse.galaxydve.com/content/4759779/4759779_source.pdf", edition_number: 3, container_id: "jokes-condoricosas", created_at: "2024-01-03T00:00:00Z" },
];

export class GalaxySource implements DataSource {
  private useMock: boolean;

  constructor() {
    this.useMock = !GALAXY_BASE_URL;
  }

  async getCollectionCategories(): Promise<CollectionCategory[]> {
    if (this.useMock) {
      return MOCK_COLLECTION_CATEGORIES.filter((c) => c.is_visible).sort((a, b) => a.sort_order - b.sort_order);
    }
    // Until Galaxy exposes categories, fall back to mock seed
    return MOCK_COLLECTION_CATEGORIES.filter((c) => c.is_visible).sort((a, b) => a.sort_order - b.sort_order);
  }

  async getContainers(options?: { contentType?: string }): Promise<Container[]> {
    if (this.useMock) {
      let result = MOCK_CONTAINERS.filter((c) => c.is_visible);
      if (options?.contentType) result = result.filter((c) => c.content_type === options.contentType);
      return result.sort((a, b) => a.sort_order - b.sort_order);
    }
    const params = new URLSearchParams();
    if (options?.contentType) params.set("content_type", options.contentType);
    const data = await galaxyFetch<any[]>(`/api/containers?${params}`);
    return data.map((c) => ({
      id: c.id,
      name: c.name,
      content_type: c.content_type,
      sort_order: c.sort_order ?? 0,
      is_visible: c.is_visible ?? true,
    }));
  }

  async getComics(options?: { limit?: number; offset?: number; containerId?: string }): Promise<Comic[]> {
    if (this.useMock) {
      let comics = MOCK_COMICS;
      if (options?.containerId) {
        comics = comics.filter((c) => c.container_id === options.containerId);
      }
      const start = options?.offset ?? 0;
      return options?.limit ? comics.slice(start, start + options.limit) : comics.slice(start);
    }
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.offset) params.set("offset", String(options.offset));
    if (options?.containerId) params.set("container_id", options.containerId);
    const data = await galaxyFetch<any[]>(`/api/comics?${params}`);
    return data.map((c) => ({
      id: c.id,
      title: c.title,
      issue_number: c.issue_number ?? 0,
      year: c.year ?? 2024,
      cover_image_url: resolveMediaUrl(c.cover_image),
      description: c.description ?? "",
      is_premium: c.is_premium ?? false,
      pdf_url: c.pdf_url ? resolveMediaUrl(c.pdf_url) : undefined,
      container_id: c.container_id,
      cms_id: c.cms_id,
      created_at: c.created_at ?? new Date().toISOString(),
    }));
  }

  async getComicById(id: string): Promise<{ comic: Comic; panels: ComicPanel[] } | null> {
    if (this.useMock) {
      const comic = MOCK_COMICS.find((c) => c.id === id);
      if (!comic) return null;
      const panels: ComicPanel[] = comic.pdf_url
        ? []
        : Array.from({ length: 4 }, (_, i) => ({
            order: i + 1,
            image_url: comic.cover_image_url,
          }));
      return { comic, panels };
    }
    const data = await galaxyFetch<any>(`/api/comics/${id}`);
    if (!data) return null;
    const comic: Comic = {
      id: data.id,
      title: data.title,
      issue_number: data.issue_number ?? 0,
      year: data.year ?? 2024,
      cover_image_url: resolveMediaUrl(data.cover_image),
      description: data.description ?? "",
      is_premium: data.is_premium ?? false,
      pdf_url: data.pdf_url ? resolveMediaUrl(data.pdf_url) : undefined,
      container_id: data.container_id,
      cms_id: data.cms_id,
      created_at: data.created_at ?? new Date().toISOString(),
    };
    const panels: ComicPanel[] = comic.pdf_url
      ? []
      : (data.panels ?? []).map((p: any, i: number) => ({
          order: i + 1,
          image_url: resolveMediaUrl(p.image),
        }));
    return { comic, panels };
  }

  async getStrips(options?: {
    freeOnly?: boolean;
    limit?: number;
    containerId?: string;
  }): Promise<ComicStrip[]> {
    if (this.useMock) return [];
    const params = new URLSearchParams();
    if (options?.freeOnly) params.set("free", "true");
    if (options?.limit) params.set("limit", String(options.limit));
    const data = await galaxyFetch<any[]>(`/api/strips?${params}`);
    return data.map((s) => ({
      id: s.id,
      title: s.title ?? "",
      panels: (s.panels ?? []).map((p: any, i: number) => ({ order: i + 1, image_url: resolveMediaUrl(p.image) })),
      pdf_url: s.pdf_url ? resolveMediaUrl(s.pdf_url) : undefined,
      preview_aspect_ratio: s.aspect_ratio,
      published_date: s.published_date ?? new Date().toISOString(),
      is_free: s.is_free ?? true,
    }));
  }

  async getLatestStrip(options?: {
    freeOnly?: boolean;
    containerId?: string;
  }): Promise<ComicStrip | null> {
    if (this.useMock) return null;
    const strips = await this.getStrips({ freeOnly: options?.freeOnly, limit: 1 });
    return strips[0] ?? null;
  }

  async getCharacters(options?: { limit?: number }): Promise<Character[]> {
    if (this.useMock) {
      const chars = MOCK_CHARACTERS;
      return options?.limit ? chars.slice(0, options.limit) : chars;
    }
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", String(options.limit));
    const data = await galaxyFetch<any[]>(`/api/characters?${params}`);
    return data.map((ch, i) => ({
      id: ch.id,
      name: ch.name,
      description: ch.description ?? "",
      avatar_image_url: resolveMediaUrl(ch.avatar),
      bio: ch.bio ?? "",
      sort_order: ch.sort_order ?? i,
    }));
  }

  async getCharacterById(id: string): Promise<Character | null> {
    if (this.useMock) return MOCK_CHARACTERS.find((c) => c.id === id) ?? null;
    const data = await galaxyFetch<any>(`/api/characters/${id}`);
    if (!data) return null;
    return {
      id: data.id,
      name: data.name,
      description: data.description ?? "",
      avatar_image_url: resolveMediaUrl(data.avatar),
      bio: data.bio ?? "",
      sort_order: data.sort_order ?? 0,
    };
  }

  async getJokes(options?: { freeOnly?: boolean; limit?: number; containerId?: string }): Promise<Joke[]> {
    if (this.useMock) {
      let jokes = MOCK_JOKES;
      if (options?.containerId) jokes = jokes.filter((j) => j.container_id === options.containerId);
      if (options?.freeOnly) jokes = jokes.filter((j) => j.is_free);
      return options?.limit ? jokes.slice(0, options.limit) : jokes;
    }
    const params = new URLSearchParams();
    if (options?.freeOnly) params.set("free", "true");
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.containerId) params.set("container_id", options.containerId);
    const data = await galaxyFetch<any[]>(`/api/jokes?${params}`);
    return data.map((j) => ({
      id: j.id,
      image_url: resolveMediaUrl(j.image),
      text_content: j.text ?? "",
      is_free: j.is_free ?? true,
      pdf_url: j.pdf_url ? resolveMediaUrl(j.pdf_url) : undefined,
      thumbnail_url: j.thumbnail_url ? resolveMediaUrl(j.thumbnail_url) : undefined,
      edition_number: j.edition_number ?? 0,
      container_id: j.container_id,
      created_at: j.created_at ?? new Date().toISOString(),
    }));
  }

  async getGames(_options?: { limit?: number }): Promise<Game[]> {
    return [];
  }
}
