/**
 * Live Pulsar catalog DataSource for Condorito.
 *
 * Reads page `home` section rails (`comic_issue` lists). PDFs: prefer
 * `deliveries[]` with `extension: "pdf"` from the eSDK; otherwise fall back
 * to a Galaxy warehouse URL built from the content id.
 */
import { PulsarHttpClient } from "../pulsar-http.ts";
import type { DataSource } from "../data-source.ts";
import type {
  Comic,
  ComicPanel,
  ComicStrip,
  Character,
  Joke,
  Container,
  CollectionCategory,
  Game,
} from "../types.ts";
import {
  DEFAULT_SECTION_MAPPINGS,
  calendarDayIndex,
  mapComicIssueToComic,
  mapComicIssueToJoke,
  mapComicIssueToStrip,
  normalizeSectionId,
  pickDailyStripId,
  sectionMappingFor,
  isFreeScreenSection,
  type PulsarComicIssueItem,
  type SectionMapping,
} from "../pulsar-mapper.ts";
import { SupabaseLocalSource } from "./supabase-local.ts";

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`PulsarSource: missing env ${name}`);
  return v;
}

function pdfOptions() {
  return {
    warehouseBaseUrl:
      Deno.env.get("GALAXY_WAREHOUSE_BASE_URL") ||
      "https://warehouse.galaxydve.com",
    country: Deno.env.get("PULSAR_COUNTRY") || "PE",
    locale: Deno.env.get("PULSAR_LOCALE") || "es-PE",
    mockPdfUrl: Deno.env.get("PULSAR_MOCK_PDF_URL") || undefined,
  };
}

export class PulsarSource implements DataSource {
  private client: PulsarHttpClient;
  /** Characters / games stay on Supabase until Pulsar exposes them. */
  private local: SupabaseLocalSource;
  private pageReference: string;
  private cache = new Map<string, { at: number; items: PulsarComicIssueItem[] }>();
  private sectionsCache: { at: number; byRef: Map<string, { covers?: string[]; title?: string }> } | null =
    null;
  private cacheTtlMs: number;

  constructor() {
    this.client = new PulsarHttpClient({
      baseUrl:
        Deno.env.get("PULSAR_BASE_URL") ||
        "https://pulsar-preview.galaxydve.com",
      username: requireEnv("PULSAR_USERNAME"),
      password: requireEnv("PULSAR_PASSWORD"),
      country: Deno.env.get("PULSAR_COUNTRY") || "PE",
      locale: Deno.env.get("PULSAR_LOCALE") || "es-PE",
    });
    this.local = new SupabaseLocalSource();
    this.pageReference = Deno.env.get("PULSAR_PAGE_REFERENCE") || "home";
    this.cacheTtlMs = Number(Deno.env.get("PULSAR_CACHE_TTL_MS") || "60000");
  }

  private mappingFor(
    containerId: string | undefined,
    kindHint: "comic" | "joke" | "strip" | "auto" = "auto",
  ): SectionMapping[] {
    return sectionMappingFor(containerId, kindHint, DEFAULT_SECTION_MAPPINGS);
  }

  private async fetchSectionIssues(
    sectionReference: string,
  ): Promise<PulsarComicIssueItem[]> {
    const ref = normalizeSectionId(sectionReference);
    const cached = this.cache.get(ref);
    if (cached && Date.now() - cached.at < this.cacheTtlMs) {
      return cached.items;
    }

    const pageSize = 50;
    let offset = 1;
    const items: PulsarComicIssueItem[] = [];

    for (;;) {
      const res = await this.client.sectionItems<PulsarComicIssueItem>(ref, {
        limit: pageSize,
        offset,
      });
      const batch = (res.payload ?? [])
        .filter((e) => !e.item_type || e.item_type === "comic_issue")
        .map((e) => e.item)
        .filter((i) => i?.item_id);
      items.push(...batch);

      const total = res.pagination?.total_items ?? items.length;
      if (batch.length === 0 || items.length >= total) break;
      offset += 1;
      if (offset > 100) break;
    }

    this.cache.set(ref, { at: Date.now(), items });
    return items;
  }

  /**
   * Loads page sections once (cached) so category rails can pick up Nova
   * section artwork from `covers[]`.
   */
  private async fetchPageSectionMeta(): Promise<
    Map<string, { covers?: string[]; title?: string }>
  > {
    if (
      this.sectionsCache &&
      Date.now() - this.sectionsCache.at < this.cacheTtlMs
    ) {
      return this.sectionsCache.byRef;
    }

    const res = await this.client.pageSections(this.pageReference, {
      limit: 50,
      offset: 1,
    });
    const byRef = new Map<string, { covers?: string[]; title?: string }>();
    for (const entry of res.payload ?? []) {
      const item = entry.item;
      const ref = item?.reference;
      if (!ref) continue;
      byRef.set(ref, {
        covers: Array.isArray(item.covers) ? item.covers : undefined,
        title: item.title || item.name,
      });
    }
    this.sectionsCache = { at: Date.now(), byRef };
    return byRef;
  }

  async getCollectionCategories(): Promise<CollectionCategory[]> {
    // Colecciones rails = Pulsar `home` comic/joke section references (cms_id),
    // enriched with section-level `covers` from Nova when present.
    // Free Screen / freemium rails (`free_*`) stay off this list.
    const sectionMeta = await this.fetchPageSectionMeta();
    const COLORS = ["#E91E8C", "#1B2A4A", "#1A8C7D", "#F5A623", "#FFDD00", "#0D6B5C"];

    return DEFAULT_SECTION_MAPPINGS.filter(
      (m) =>
        (m.kind === "comic" || m.kind === "joke") &&
        !isFreeScreenSection(m.containerId),
    )
      .map((m, i) => {
        const meta = sectionMeta.get(m.containerId) ??
          sectionMeta.get(normalizeSectionId(m.containerId));
        const imageUrl = Array.isArray(meta?.covers) ? (meta.covers[0] ?? "") : "";
        return {
          id: m.containerId,
          title: (meta?.title || m.containerName).toUpperCase(),
          subtitle: m.kind === "joke" ? "Humor rápido" : "Colección",
          background_color: COLORS[i % COLORS.length],
          image_url: imageUrl || undefined,
          sort_order: i + 1,
          is_visible: true,
          action_route: `/colecciones/category/${m.containerId}`,
          cms_id: m.containerId,
        };
      });
  }

  async getContainers(options?: { contentType?: string }): Promise<Container[]> {
    let rows: Container[] = DEFAULT_SECTION_MAPPINGS.map((m, i) => ({
      id: m.containerId,
      name: m.containerName,
      content_type: m.contentType,
      sort_order: i + 1,
      is_visible: true,
    }));
    if (options?.contentType) {
      rows = rows.filter((c) => c.content_type === options.contentType);
    }
    return rows;
  }

  async getComics(options?: {
    limit?: number;
    offset?: number;
    containerId?: string;
  }): Promise<Comic[]> {
    const mappings = this.mappingFor(options?.containerId, "comic");
    const opts = pdfOptions();
    const comics: Comic[] = [];

    for (const mapping of mappings) {
      const issues = await this.fetchSectionIssues(mapping.sectionReference);
      for (const item of issues) {
        const row = mapComicIssueToComic(item, mapping, opts);
        comics.push({
          id: row.cms_id,
          title: row.title,
          issue_number: row.issue_number,
          year: row.year,
          cover_image_url: row.cover_image_url,
          description: row.description,
          is_premium: row.is_premium,
          pdf_url: row.pdf_url,
          publication_date: row.publication_date,
          page_count: row.page_count,
          reading_direction: row.reading_direction,
          container_id: row.container_id,
          cms_id: row.cms_id,
          created_at: new Date().toISOString(),
        });
      }
    }

    const start = options?.offset ?? 0;
    return options?.limit
      ? comics.slice(start, start + options.limit)
      : comics.slice(start);
  }

  async getComicById(
    id: string,
  ): Promise<{ comic: Comic; panels: ComicPanel[] } | null> {
    const comics = await this.getComics();
    const comic = comics.find((c) => c.id === id || c.cms_id === id) ?? null;
    if (!comic) return null;
    return { comic, panels: [] };
  }

  async getStrips(options?: {
    freeOnly?: boolean;
    limit?: number;
    containerId?: string;
  }): Promise<ComicStrip[]> {
    const mappings = this.mappingFor(
      options?.containerId ?? "strip_of_the_day_2",
      "strip",
    );
    const mapping = mappings[0];
    if (!mapping) return [];
    const opts = pdfOptions();
    const issues = await this.fetchSectionIssues(mapping.sectionReference);
    let strips = issues.map((item) => {
      const row = mapComicIssueToStrip(item, opts);
      return {
        id: row.cms_id,
        title: row.title,
        panels: row.panels,
        pdf_url: row.pdf_url,
        published_date: row.published_date,
        publication_date: row.publication_date,
        page_count: row.page_count,
        reading_direction: row.reading_direction,
        is_free: row.is_free,
        cms_id: row.cms_id,
      } satisfies ComicStrip;
    });
    // freeOnly ignored for Pulsar strips: management shows all previews.
    return options?.limit ? strips.slice(0, options.limit) : strips;
  }

  async getLatestStrip(options?: {
    freeOnly?: boolean;
    containerId?: string;
  }): Promise<ComicStrip | null> {
    const strips = await this.getStrips({
      containerId: options?.containerId ?? "strip_of_the_day_2",
    });
    if (!strips.length) return null;

    const tz = Deno.env.get("PULSAR_STRIP_TZ") || "America/Lima";
    const dayIndex = calendarDayIndex(Date.now(), tz);
    const ids = strips.map((s) => s.cms_id || s.id);
    const pickId = pickDailyStripId(ids, dayIndex);
    const picked =
      strips.find((s) => (s.cms_id || s.id) === pickId) ?? strips[0];
    return picked ?? null;
  }

  async getCharacters(options?: { limit?: number }): Promise<Character[]> {
    return this.local.getCharacters(options);
  }

  async getCharacterById(id: string): Promise<Character | null> {
    return this.local.getCharacterById(id);
  }

  async getJokes(options?: {
    freeOnly?: boolean;
    limit?: number;
    containerId?: string;
  }): Promise<Joke[]> {
    const mappings = this.mappingFor(options?.containerId, "joke");
    const opts = pdfOptions();
    const jokes: Joke[] = [];

    for (const mapping of mappings) {
      const issues = await this.fetchSectionIssues(mapping.sectionReference);
      for (const item of issues) {
        const row = mapComicIssueToJoke(item, mapping, opts);
        jokes.push({
          id: row.cms_id,
          image_url: row.image_url,
          text_content: row.text_content,
          is_free: row.is_free,
          pdf_url: row.pdf_url,
          thumbnail_url: row.thumbnail_url,
          edition_number: row.edition_number,
          publication_date: row.publication_date,
          page_count: row.page_count,
          reading_direction: row.reading_direction,
          container_id: row.container_id,
          cms_id: row.cms_id,
          created_at: new Date().toISOString(),
        });
      }
    }

    let result = jokes;
    if (options?.freeOnly) result = result.filter((j) => j.is_free);
    return options?.limit ? result.slice(0, options.limit) : result;
  }

  async getGames(options?: { limit?: number }): Promise<Game[]> {
    return this.local.getGames(options);
  }
}

