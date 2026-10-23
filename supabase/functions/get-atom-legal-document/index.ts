import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { JsonApiHttpError } from "npm:@digitalvirgo/atom-api@1.25.0";
import { corsHeaders, errorResponse, handleCors, jsonResponse } from "../_shared/cors.ts";
import {
  discoverAtomDocuments,
  documentsFromProductFind,
  fetchAtomDocumentHtml,
  fetchProductWithLegalDocuments,
  findAtomDocument,
  getAtomApi,
} from "../_shared/atom-legal.ts";

async function parseParams(req: Request) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  return {
    mode: body.mode === "document" ? "document" : "discover",
    locale: String(body.language ?? "fr").trim().toLowerCase(),
    atomProductId: body.atom_product_id != null ? String(body.atom_product_id).trim() : "",
    format: body.format != null ? String(body.format).trim() : "",
    date: body.date != null ? String(body.date).trim() : undefined,
  } as const;
}

function errorStatus(message: string): number {
  if (message.includes("not configured") || message.includes("login failed")) return 500;
  if (message.includes("not found") || message.includes("Not found")) return 404;
  if (message.includes("required") || message.includes("must be")) return 400;
  return 500;
}

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const params = await parseParams(req);
    if (!params.atomProductId) return errorResponse("atom product id is required", 400);
    const atomProductId = Number(params.atomProductId);
    if (!Number.isFinite(atomProductId)) return errorResponse("atom_product_id must be a number", 400);

    const api = await getAtomApi();
    if (params.mode === "discover") {
      return jsonResponse({ ok: true, requestedLanguage: params.locale, ...await discoverAtomDocuments(api, atomProductId, params.locale) });
    }

    if (!params.format) return errorResponse("document_format (or format / document_slug) is required for document mode", 400);
    const catalog = await fetchProductWithLegalDocuments(api, atomProductId);
    const document = findAtomDocument(documentsFromProductFind(catalog), params.format);
    if (!document) return errorResponse(`Document not found in product catalog: ${params.format}`, 404);

    const bodyHtml = await fetchAtomDocumentHtml(api, atomProductId, document.documentType, params.locale, params.date);
    if (req.headers.get("Accept")?.includes("text/html")) {
      return new Response(bodyHtml, { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } });
    }
    return jsonResponse({
      ok: true,
      document: {
        title: document.name,
        body_html: bodyHtml,
        version: 1,
        updated_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    if (err instanceof JsonApiHttpError) return jsonResponse({ ok: false, error: err.message, status: err.status, errors: err.errors }, err.status >= 400 && err.status < 600 ? err.status : 502);
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(message, errorStatus(message));
  }
});
