import {
  JsonApiService,
  LegalDocument,
  Product,
} from "npm:@digitalvirgo/atom-api@1.25.0";

export type AtomDocument = { id: string; name: string; documentType: string };
export type AtomProductFind = Awaited<ReturnType<JsonApiService["find"]>>;

let cachedAccessToken: string | null = null;

function atomConfig() {
  return {
    baseUrl: (Deno.env.get("ATOM_BASE_URL") ?? "https://atom.digitalvirgo.com").replace(/\/+$/, ""),
    user: Deno.env.get("ATOM_USER"),
    pass: Deno.env.get("ATOM_SDK_ACCESS_KEY") ?? "",
  };
}

async function atomLogin(baseUrl: string, user: string, pass: string): Promise<string> {
  const res = await fetch(`${baseUrl}/auth/token`, {
    method: "GET",
    headers: { Accept: "application/vnd.api+json", Authorization: `Basic ${btoa(`${user}:${pass}`)}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as { errors?: { detail?: string }[] })?.errors?.[0]?.detail;
    throw new Error(`ATOM login failed: ${detail ?? `HTTP ${res.status}`}`);
  }
  const token = (data as { access_token?: string }).access_token;
  if (!token) throw new Error("ATOM login: missing access_token");
  return token;
}

export async function getAtomApi(): Promise<JsonApiService> {
  const config = atomConfig();
  if (!config.user || !config.pass) throw new Error("ATOM credentials not configured");
  if (!cachedAccessToken) cachedAccessToken = await atomLogin(config.baseUrl, config.user, config.pass);
  return new JsonApiService({ url: config.baseUrl, version: "api", headers: () => ({ Authorization: `Bearer ${cachedAccessToken}` }) });
}

export async function fetchProductWithLegalDocuments(api: JsonApiService, atomProductId: number | string): Promise<AtomProductFind> {
  return await api.find(Product, String(atomProductId), { include: "legaldocuments" });
}

function documentFromLegalDocument(doc: LegalDocument): AtomDocument | null {
  const documentType = String(doc.documentType ?? "").trim();
  if (!documentType) return null;
  return { id: String(doc.id ?? ""), name: String(doc.name ?? "").trim() || documentType, documentType };
}

export function documentsFromProductFind(result: AtomProductFind): AtomDocument[] {
  const product = result.data as Product;
  const fromProduct = (product.legaldocuments ?? []).map(documentFromLegalDocument).filter((doc): doc is AtomDocument => doc !== null);
  if (fromProduct.length) return fromProduct;
  return ((result.included ?? []) as LegalDocument[])
    .filter((item) => (item as { type?: string }).type === undefined || (item as { type?: string }).type === "legaldocuments")
    .map(documentFromLegalDocument)
    .filter((doc): doc is AtomDocument => doc !== null);
}

export function findAtomDocument(documents: AtomDocument[], key: string): AtomDocument | undefined {
  const trimmed = key.trim();
  const lower = trimmed.toLowerCase();
  return documents.find((doc) => doc.documentType === trimmed || doc.name === trimmed || doc.id === trimmed || doc.documentType.toLowerCase() === lower || doc.name.toLowerCase() === lower);
}

export async function fetchAtomDocumentHtml(api: JsonApiService, atomProductId: number | string, documentType: string, locale: string, date = new Date().toISOString().split("T")[0]): Promise<string> {
  const path = `products/${atomProductId}/document/${documentType}/html/${locale}/${date}`;
  const { body, status } = await api.getVisualiseLegalDocuments(path);
  if (status < 200 || status >= 300) throw new Error(`Document not found: ${documentType}/${locale}`);
  return await body.text();
}

export async function discoverAtomDocuments(api: JsonApiService, atomProductId: number | string) {
  const documents = documentsFromProductFind(await fetchProductWithLegalDocuments(api, atomProductId));
  return {
    documents: documents.map((document) => ({
      id: document.id,
      name: document.name,
      sourceDocumentFormat: document.name,
      documentFormat: document.documentType,
    })),
    formatsDiscovered: documents.map((document) => document.documentType),
  };
}
