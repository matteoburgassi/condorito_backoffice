import type { DataSource } from "../data-source.ts";
import type { Comic, ComicPanel, ComicStrip, Character, Joke, Container, CollectionCategory, Game } from "../types.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

export class SupabaseLocalSource implements DataSource {
  private supabase;

  constructor() {
    this.supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }

  async getCollectionCategories(): Promise<CollectionCategory[]> {
    const { data, error } = await this.supabase
      .from("collection_categories")
      .select("*")
      .eq("is_visible", true)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async getContainers(options?: { contentType?: string }): Promise<Container[]> {
    let query = this.supabase
      .from("containers")
      .select("*")
      .eq("is_visible", true)
      .order("sort_order", { ascending: true });

    if (options?.contentType) {
      query = query.eq("content_type", options.contentType);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async getComics(options?: { limit?: number; offset?: number; containerId?: string }): Promise<Comic[]> {
    let query = this.supabase
      .from("comics")
      .select("*")
      .order("issue_number", { ascending: false });

    if (options?.containerId) {
      query = query.eq("container_id", options.containerId);
    }

    if (options?.limit) {
      const start = options.offset ?? 0;
      query = query.range(start, start + options.limit - 1);
    } else if (options?.offset) {
      query = query.range(options.offset, options.offset + 999);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async getComicById(id: string): Promise<{ comic: Comic; panels: ComicPanel[] } | null> {
    const { data: comic, error } = await this.supabase
      .from("comics")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!comic) return null;

    const panels: ComicPanel[] = comic.pdf_url
      ? []
      : Array.from({ length: 4 }, (_, i) => ({
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
    let query = this.supabase
      .from("comic_strips")
      .select("*")
      .order("published_date", { ascending: false });

    if (options?.freeOnly) query = query.eq("is_free", true);
    if (options?.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async getLatestStrip(options?: {
    freeOnly?: boolean;
    containerId?: string;
  }): Promise<ComicStrip | null> {
    let query = this.supabase
      .from("comic_strips")
      .select("*")
      .order("published_date", { ascending: false })
      .limit(1);

    if (options?.freeOnly) query = query.eq("is_free", true);

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data ?? null;
  }

  async getCharacters(options?: { limit?: number }): Promise<Character[]> {
    let query = this.supabase
      .from("characters")
      .select("*")
      .order("sort_order", { ascending: true });

    if (options?.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async getCharacterById(id: string): Promise<Character | null> {
    const { data, error } = await this.supabase
      .from("characters")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  }

  async getJokes(options?: { freeOnly?: boolean; limit?: number; containerId?: string }): Promise<Joke[]> {
    let query = this.supabase
      .from("jokes")
      .select("*")
      .order("created_at", { ascending: false });

    if (options?.containerId) query = query.eq("container_id", options.containerId);
    if (options?.freeOnly) query = query.eq("is_free", true);
    if (options?.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async getGames(options?: { limit?: number }): Promise<Game[]> {
    let query = this.supabase
      .from("games")
      .select("*")
      .order("title", { ascending: true });

    if (options?.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }
}
