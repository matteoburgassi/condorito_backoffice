// deploy: 2026-10-16
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  documentContentCandidates,
  parseDocumentPlatform,
} from "../_shared/document-platform.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const productSlug = url.searchParams.get("product_slug");
    const documentSlug = url.searchParams.get("document_slug");
    const locale = url.searchParams.get("locale") || "en";
    const environment = url.searchParams.get("environment") || "production";
    const platform = parseDocumentPlatform(
      url.searchParams.get("platform"),
      url.searchParams.get("is_desktop"),
    );

    if (!productSlug || !documentSlug) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required params: product_slug, document_slug" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // `product_slug` is unique; ignore `environment` until BO publishes per-env products.
    const { data: product } = await supabase
      .from("product_products")
      .select("id")
      .eq("slug", productSlug)
      .maybeSingle();

    if (!product) {
      return new Response(
        JSON.stringify({ ok: false, error: "Product not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find document
    const { data: doc } = await supabase
      .from("product_documents")
      .select("id, version, updated_at")
      .eq("product_id", product.id)
      .eq("slug", documentSlug)
      .single();

    if (!doc) {
      return new Response(
        JSON.stringify({ ok: false, error: "Document not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Locale + platform match, with desktop→mobile then English fallbacks.
    let content: { title: string; body_html: string } | null = null;
    for (const candidate of documentContentCandidates(locale, platform)) {
      const { data } = await supabase
        .from("product_document_content")
        .select("title, body_html")
        .eq("document_id", doc.id)
        .eq("locale", candidate.locale)
        .eq("is_desktop", candidate.is_desktop)
        .maybeSingle();
      if (data) {
        content = data;
        break;
      }
    }

    if (!content) {
      return new Response(
        JSON.stringify({ ok: false, error: "Document content not found for locale" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        document: {
          title: content.title,
          body_html: content.body_html,
          version: doc.version,
          updated_at: doc.updated_at,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
