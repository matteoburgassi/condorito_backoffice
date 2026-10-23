export type DocumentPlatform = "mobile" | "desktop";

export type DocumentContentCandidate = {
  locale: string;
  is_desktop: boolean;
};

export function normalizeDocumentLocale(locale: string | null | undefined): string {
  return (locale?.trim().toLowerCase() || "en");
}

export function translationKeyParts(key: string): { namespace: string; key: string } | null {
  const separator = key.indexOf(".");
  if (separator <= 0 || separator === key.length - 1) return null;
  return { namespace: key.slice(0, separator), key: key.slice(separator + 1) };
}

export function resolveTranslation(
  translations: Record<string, Record<string, string>>,
  translationKey: string,
): string {
  const parts = translationKeyParts(translationKey.trim());
  if (!parts) return translationKey.trim();
  return translations[parts.namespace]?.[parts.key] || translationKey.trim();
}

/**
 * Accepts the screen-style `platform=desktop|mobile` query and/or
 * `is_desktop=true|1`. Missing/invalid values mean mobile.
 */
export function parseDocumentPlatform(
  platform: string | null,
  isDesktopFlag: string | null,
): DocumentPlatform {
  if (platform === "desktop") return "desktop";
  if (isDesktopFlag === "true" || isDesktopFlag === "1") return "desktop";
  return "mobile";
}

/**
 * Ordered (locale, is_desktop) lookups for document content.
 * Desktop falls back to mobile for the same locale, then English with the
 * same desktop→mobile chain. Mobile never reads desktop rows.
 */
export function documentContentCandidates(
  locale: string,
  platform: DocumentPlatform,
): DocumentContentCandidate[] {
  const wantDesktop = platform === "desktop";
  const normalizedLocale = normalizeDocumentLocale(locale);
  const locales = normalizedLocale === "en" ? ["en"] : [normalizedLocale, "en"];
  const candidates: DocumentContentCandidate[] = [];

  for (const loc of locales) {
    if (wantDesktop) {
      candidates.push({ locale: loc, is_desktop: true });
    }
    candidates.push({ locale: loc, is_desktop: false });
  }

  return candidates;
}
