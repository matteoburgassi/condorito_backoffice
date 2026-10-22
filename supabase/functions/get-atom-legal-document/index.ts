import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  JsonApiHttpError,
  JsonApiService,
  LegalDocument,
  Product,
} from "@digitalvirgo/atom-api";
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestParams {
  mode: "discover" | "document";
  locale: string;
  atomProductId?: string | null;
  documentFormat?: string | null;
  date?: string | null;
}

let cachedAccessToken: string | null = null;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function getAtomConfig() {
  const baseUrl = (Deno.env.get("ATOM_BASE_URL") ?? "https://atom.digitalvirgo.com").replace(/\/+$/, "");
  const user = Deno.env.get("ATOM_USER");
  const pass = Deno.env.get("ATOM_SDK_ACCESS_KEY") ?? "";
  return { baseUrl, user, pass };
}

async function atomLogin(
  baseUrl: string,
  user: string,
  pass: string,
): Promise<string> {
  const credentials = btoa(`${user}:${pass}`);
  const res = await fetch(`${baseUrl}/auth/token`, {
    method: "GET",
    headers: {
      Accept: "application/vnd.api+json",
      Authorization: `Basic ${credentials}`,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as { errors?: { detail?: string }[] })?.errors?.[0]
      ?.detail;
    throw new Error(
      `ATOM login failed: ${detail ?? `HTTP ${res.status}`}`,
    );
  }
  const token = (data as { access_token?: string }).access_token;
  if (!token) throw new Error("ATOM login: missing access_token");
  return token;
}

async function getAtomApi(): Promise<JsonApiService> {
  const cfg = getAtomConfig();
  if (!cfg.user || !cfg.pass) {
    throw new Error("ATOM credentials not configured");
  }

  if (!cachedAccessToken) {
    cachedAccessToken = await atomLogin(cfg.baseUrl, cfg.user, cfg.pass);
  }

  return new JsonApiService({
    url: cfg.baseUrl,
    version: "api",
    headers: () => ({ Authorization: `Bearer ${cachedAccessToken}` }),
  });
}

function resolveAtomProductIdFromParam(
  atomProductIdParam: string,
  locale: string,
): { atomProductId: number; resolvedLocale: string } {
  const n = Number(atomProductIdParam);
  if (!Number.isFinite(n)) {
    throw new Error("atom_product_id must be a number");
  }
  const loc = locale.toLowerCase();
  return {
    atomProductId: n,
    resolvedLocale: loc,
  };
}

interface Document {
  id: string;
  name: string;
  documentType: string;
}

type ProductFindDocument = Awaited<ReturnType<JsonApiService["find"]>>;

function documentFromLegalDocument(doc: LegalDocument): Document | null {
  const documentType = doc.documentType.trim();
  if (!documentType) return null;
  const name = String(doc.name ?? "").trim() || documentType;
  return {
    id: String(doc.id ?? ""),
    name,
    documentType,
  };
}

function documentsFromProductFind(doc: ProductFindDocument): Document[] {
  const product = doc.data as Product;
  const fromProduct = (product.legaldocuments ?? [])
    .map(documentFromLegalDocument)
    .filter((e): e is Document => e !== null);

  if (fromProduct.length > 0) return fromProduct;

  const included = (doc.included ?? []) as LegalDocument[];
  return included
    .filter((item) => {
      const type = (item as { type?: string }).type;
      return type === undefined || type === "legaldocuments";
    })
    .map(documentFromLegalDocument)
    .filter((e): e is Document => e !== null);
}

async function fetchProductWithLegalDocuments(
  api: JsonApiService,
  atomProductId: number,
): Promise<ProductFindDocument> {
  return await api.find(Product, String(atomProductId), {
    include: "legaldocuments",
  });
}

function findDocument(document: Document[], key: string): Document | undefined {
  const trimmed = key.trim();
  const lower = trimmed.toLowerCase();
  return document.find(
    (e) =>
      e.documentType === trimmed ||
      e.name === trimmed ||
      e.id === trimmed ||
      e.documentType.toLowerCase() === lower ||
      e.name.toLowerCase() === lower,
  );
}

async function discoverDocuments(
  api: JsonApiService,
  atomProductId: number,
  lang: string,
) {
  const doc = await fetchProductWithLegalDocuments(api, atomProductId);
  const documents = documentsFromProductFind(doc);
  const today = new Date().toISOString().split("T")[0];

  const results: Array<{
    id: string;
    name: string;
    sourceDocumentFormat: string;
    documentFormat: string;
  }> = [];

  for (const document of documents) {
    const path =
      `products/${atomProductId}/document/${document.documentType}/html/${lang}/${today}`;
    try {
      const { status } = await api.getVisualiseLegalDocuments(path);
      if (status >= 200 && status < 300) {
        results.push({
          id: document.id,
          name: document.name,
          sourceDocumentFormat: document.name,
          documentFormat: document.documentType,
        });
      }
    } catch {
      /* skip */
    }
  }

  return {
    documents: results,
    formatsDiscovered: documents.map((document) => document.documentType),
  };
}

async function fetchDocumentHtml(
  api: JsonApiService,
  atomProductId: number,
  documentType: string,
  language: string,
  date?: string,
): Promise<string> {
  const day = date ?? new Date().toISOString().split("T")[0];
  const path =
    `products/${atomProductId}/document/${documentType}/html/${language}/${day}`;
  const { body, status } = await api.getVisualiseLegalDocuments(path);
  if (status < 200 || status >= 300) {
    throw new Error(`Document not found: ${documentType}/${language}`);
  }
  return await body.text();
}

async function parseParams(req: Request): Promise<RequestParams> {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const documentFormat = body.format;
  const mode = body.mode === "document" ? "document" : "discover";

  return {
    mode,
    locale: String(body.language ?? "fr").toLowerCase(),
    atomProductId: body.atom_product_id != null
      ? String(body.atom_product_id)
      : null,
    documentFormat: documentFormat != null ? String(documentFormat) : null,
    date: body.date != null ? String(body.date) : null,
  };
}

function httpStatusFromError(message: string): number {
  if (message.includes("not configured") || message.includes("login failed")) {
    return 500;
  }
  if (message.includes("not found") || message.includes("Not found")) {
    return 404;
  }
  if (message.includes("required") || message.includes("must be")) return 400;
  return 500;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const params = await parseParams(req);

    if (!params.atomProductId) {
      return json(
        {
          ok: false,
          error: "atom product id is required",
        },
        500,
      );
    }
    const { atomProductId, resolvedLocale } = resolveAtomProductIdFromParam(
      params.atomProductId,
      params.locale,
    );

    const api = await getAtomApi();

    if (params.mode === "discover") {
      const discovery = await discoverDocuments(api, atomProductId, resolvedLocale);
      return json({
        ok: true,
        requestedLanguage: resolvedLocale,
        ...discovery,
      });
    }

    const formatKey = params.documentFormat?.trim();
    if (!formatKey) {
      return json(
        {
          ok: false,
          error:
            "document_format (or format / document_slug) is required for document mode",
        },
        400,
      );
    }

    const productDoc = await fetchProductWithLegalDocuments(api, atomProductId);
    const documents = documentsFromProductFind(productDoc);
    const document = findDocument(documents, formatKey);
    if (!document) {
      return json(
        {
          ok: false,
          error: `Document not found in product catalog: ${formatKey}`,
          atom_product_id: atomProductId,
          documents: documents.map((d) => ({
            id: d.id,
            name: d.name,
            documentType: d.documentType,
          })),
        },
        404,
      );
    }

    const bodyHtml = await fetchDocumentHtml(
      api,
      atomProductId,
      document.documentType,
      resolvedLocale,
      params.date ?? undefined,
    );

    const accept = req.headers.get("Accept") ?? "";
    if (accept.includes("text/html")) {
      return new Response(bodyHtml, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    }

    return json({
      ok: true,
      document: {
        slug: document.documentType,
        document_type: document.documentType,
        name: document.name,
        locale: resolvedLocale,
        body_html: bodyHtml,
        updated_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    if (err instanceof JsonApiHttpError) {
      return json(
        {
          ok: false,
          error: err.message,
          status: err.status,
          errors: err.errors,
        },
        err.status >= 400 && err.status < 600 ? err.status : 502,
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return json({ ok: false, error: message }, httpStatusFromError(message));
  }
});
