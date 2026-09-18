import { DOCLANG_EXTENSION, DOCLANG_MEDIA_TYPE } from "./doclang-constants.js";

/** Content negotiation helpers for machine traffic. */

export function prefersMarkdown(acceptHeader: string | null): boolean {
  if (!acceptHeader) return false;
  return acceptHeader.toLowerCase().includes("text/markdown");
}

export function prefersJsonLd(acceptHeader: string | null): boolean {
  if (!acceptHeader) return false;
  const lower = acceptHeader.toLowerCase();
  return lower.includes("application/ld+json") || lower.includes("application/json");
}

export function prefersDocLang(acceptHeader: string | null): boolean {
  if (!acceptHeader) return false;
  const lower = acceptHeader.toLowerCase();
  return lower.includes(DOCLANG_MEDIA_TYPE) || lower.includes("application/doclang+xml");
}

/** Browser-style Accept: they asked for HTML, not an alternate machine format. */
export function prefersHtml(acceptHeader: string | null): boolean {
  if (!acceptHeader) return false;
  const lower = acceptHeader.toLowerCase();
  if (
    lower.includes("text/markdown") ||
    lower.includes(DOCLANG_MEDIA_TYPE) ||
    lower.includes("application/doclang+xml") ||
    lower.includes("application/ld+json")
  ) {
    return false;
  }
  return lower.includes("text/html");
}

export function isDocLangPath(pathname: string): boolean {
  return pathname.endsWith(DOCLANG_EXTENSION) || pathname.endsWith(`/index${DOCLANG_EXTENSION}`);
}

export function isMarkdownPath(pathname: string): boolean {
  return pathname.endsWith(".md") || pathname.endsWith("/index.md");
}

export function isJsonLdPath(pathname: string): boolean {
  return pathname.endsWith(".jsonld");
}

/** Strip `.md` or `/index.md` suffix to get the canonical HTML path. */
export function stripMarkdownSuffix(pathname: string): string {
  if (pathname.endsWith("/index.md")) {
    const base = pathname.slice(0, -"/index.md".length);
    return base === "" ? "/" : base.endsWith("/") ? base : `${base}/`;
  }
  if (pathname.endsWith(".md")) {
    return pathname.slice(0, -3) || "/";
  }
  return pathname;
}

/** Rewrite a path to the `/index.md` URL fallback pattern. */
export function toIndexMdPath(pathname: string): string {
  const normalized = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return normalized === "/" ? "/index.md" : `${normalized}index.md`;
}

/** Strip `.jsonld` suffix to get the canonical HTML path. */
export function stripJsonLdSuffix(pathname: string): string {
  if (pathname.endsWith(".jsonld")) {
    const base = pathname.slice(0, -".jsonld".length);
    return base === "" ? "/" : base.endsWith("/") ? base : `${base}/`;
  }
  return pathname;
}

/** Rewrite a path to the `.jsonld` URL pattern for structured product data. */
export function toJsonLdPath(pathname: string): string {
  if (pathname === "/") return "/index.jsonld";
  const normalized = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return `${normalized}.jsonld`;
}

/** Strip `.dclg` or `/index.dclg` suffix to get the canonical HTML path. */
export function stripDocLangSuffix(pathname: string): string {
  if (pathname.endsWith(`/index${DOCLANG_EXTENSION}`)) {
    const base = pathname.slice(0, -(`/index${DOCLANG_EXTENSION}`).length);
    return base === "" ? "/" : base.endsWith("/") ? base : `${base}/`;
  }
  if (pathname.endsWith(DOCLANG_EXTENSION)) {
    const base = pathname.slice(0, -DOCLANG_EXTENSION.length);
    return base === "" ? "/" : base.endsWith("/") ? base : `${base}/`;
  }
  return pathname;
}

/** Rewrite a path to the `.dclg` URL pattern for DocLang content. */
export function toDocLangPath(pathname: string): string {
  if (pathname === "/") return `/index${DOCLANG_EXTENSION}`;
  const normalized = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return `${normalized}${DOCLANG_EXTENSION}`;
}
