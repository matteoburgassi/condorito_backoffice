// deploy: 2026-10-22
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse, handleCors, jsonResponse } from "../_shared/cors.ts";
import {
  documentContentCandidates,
  parseDocumentPlatform,
  normalizeDocumentLocale,
  translationKeyParts,
} from "../_shared/document-platform.ts";
import {
  documentsFromProductFind,
  fetchAtomDocumentHtml,
  fetchProductWithLegalDocuments,
  findAtomDocument,
  getAtomApi,
} from "../_shared/atom-legal.ts";

async function resolveDocumentTitle(
  supabase: any,
  productId: string,
  titleKey: string,
  locale: string,
): Promise<string> {
  const parts = translationKeyParts(titleKey);
  if (!parts) return titleKey;

  const requestedLocale = normalizeDocumentLocale(locale);
  const locales = requestedLocale === "en" ? ["en"] : [requestedLocale, "en"];
  const { data, error } = await supabase
    .from("product_translations")
    .select("language_code, value")
    .eq("product_id", productId)
    .eq("namespace", parts.namespace)
    .eq("key", parts.key)
    .in("language_code", locales);
  if (error) throw new Error(`Document title lookup failed: ${error.message}`);

  for (const language of locales) {
    const translation = (data ?? []).find((row) => row.language_code === language);
    if (translation?.value) return translation.value;
  }
  return titleKey;
}

Deno.serve(async (req: Request) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const url = new URL(req.url);
    const productSlug = url.searchParams.get("product_slug")?.trim();
    const documentSlug = url.searchParams.get("document_slug")?.trim();
    const locale = (url.searchParams.get("locale") || "en").toLowerCase();
    const platform = parseDocumentPlatform(
      url.searchParams.get("platform"),
      url.searchParams.get("is_desktop"),
    );

    if (!productSlug || !documentSlug) {
      return jsonResponse(
        { ok: false, error: "Missing required params: product_slug, document_slug" },
        400,
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // `product_slug` is unique; ignore `environment` until BO publishes per-env products.
    const { data: product, error: productError } = await supabase
      .from("product_products")
      .select("id")
      .eq("slug", productSlug)
      .maybeSingle();

    if (productError) throw new Error(`Product lookup failed: ${productError.message}`);
    if (!product) {
      return errorResponse("Product not found", 200);
    }

    const { data: doc, error: documentError } = await supabase
      .from("product_documents")
      .select("id, title, version, updated_at, is_atom")
      .eq("product_id", product.id)
      .eq("slug", documentSlug)
      .maybeSingle();

    if (documentError) throw new Error(`Document lookup failed: ${documentError.message}`);
    if (!doc) {
      return errorResponse("Document not found", 200);
    }
    const documentTitle = await resolveDocumentTitle(supabase, product.id, doc.title, locale);

    // ATOM documents: the slug is the ATOM documentFormat. Platform is ignored
    // because ATOM serves a single HTML per document and language.
    if (doc.is_atom) {
      const { data: config, error: configError } = await supabase
        .from("product_config")
        .select("value")
        .eq("product_id", product.id)
        .eq("key", "ATOM_PRODUCT_ID")
        .maybeSingle();
      if (configError) throw new Error(`ATOM configuration lookup failed: ${configError.message}`);
      const atomProductId = config?.value?.trim();
      if (!atomProductId) {
        return errorResponse("ATOM_PRODUCT_ID not configured", 500);
      }

      const atomApi = await getAtomApi();
      const catalog = await fetchProductWithLegalDocuments(atomApi, atomProductId);
      const atomDocument = findAtomDocument(documentsFromProductFind(catalog), documentSlug);
      if (!atomDocument) {
        return errorResponse("Document not found", 200);
      }
      const bodyHtml = await fetchAtomDocumentHtml(
        atomApi,
        atomProductId,
        atomDocument.documentType,
        locale,
      );

      return jsonResponse({
        ok: true,
        document: {
          title: documentTitle,
          body_html: bodyHtml,
          version: doc.version,
          updated_at: doc.updated_at,
        },
      });
    }

    // Locale + platform match, with desktop→mobile then English fallbacks.
    let content: { title: string; body_html: string } | null = null;
    for (const candidate of documentContentCandidates(locale, platform)) {
      const { data, error: contentError } = await supabase
        .from("product_document_content")
        .select("title, body_html")
        .eq("document_id", doc.id)
        .eq("locale", candidate.locale)
        .eq("is_desktop", candidate.is_desktop)
        .maybeSingle();
      if (contentError) throw new Error(`Document content lookup failed: ${contentError.message}`);
      if (data) {
        content = data;
        break;
      }
    }

    if (!content) {
      return errorResponse("Document content not found for locale", 200);
    }

    return jsonResponse({
      ok: true,
      document: {
        title: documentTitle,
        body_html: content.body_html,
        version: doc.version,
        updated_at: doc.updated_at,
      },
    });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
