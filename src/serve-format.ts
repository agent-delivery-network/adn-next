import {
  isDocLangPath,
  isJsonLdPath,
  isMarkdownPath,
  prefersDocLang,
  prefersHtml,
  prefersJsonLd,
  prefersMarkdown,
} from "./negotiate.js";

export const SERVE_FORMATS = ["html", "markdown", "doclang", "json", "other"] as const;
export type ServeFormat = (typeof SERVE_FORMATS)[number];

export function isServeFormat(value: string): value is ServeFormat {
  return (SERVE_FORMATS as readonly string[]).includes(value);
}

/**
 * Format actually served (or requested, when the response has not been seen yet).
 * Content-Type wins, then URL suffix, then Accept.
 */
export function resolveServeFormat(input: {
  pathname?: string;
  accept?: string | null;
  contentType?: string | null;
}): ServeFormat {
  const contentType = (input.contentType ?? "").toLowerCase();
  if (contentType.includes("text/markdown")) return "markdown";
  if (contentType.includes("doclang")) return "doclang";
  if (contentType.includes("application/ld+json") || contentType.includes("application/json")) {
    return "json";
  }
  if (contentType.includes("text/html")) return "html";

  const pathname = input.pathname ?? "";
  if (isDocLangPath(pathname)) return "doclang";
  if (isMarkdownPath(pathname)) return "markdown";
  if (isJsonLdPath(pathname) || pathname.endsWith(".json")) return "json";
  if (pathname === "/llms.txt" || pathname === "/llms-full.txt" || pathname === "/agents.txt") {
    return "markdown";
  }

  const accept = input.accept ?? null;
  if (prefersDocLang(accept)) return "doclang";
  if (prefersMarkdown(accept)) return "markdown";
  if (prefersJsonLd(accept)) return "json";
  return "html";
}

export function wantsAlternateFormat(pathname: string, accept: string | null): boolean {
  return (
    isMarkdownPath(pathname) ||
    isDocLangPath(pathname) ||
    isJsonLdPath(pathname) ||
    prefersMarkdown(accept) ||
    prefersDocLang(accept) ||
    prefersJsonLd(accept)
  );
}

/**
 * Shim forwarding signal. Same as wantsAlternateFormat except generic
 * `application/json` is not enough — that matches ordinary XHR/axios clients.
 * JSON-LD is `application/ld+json` or a `.jsonld` suffix.
 */
export function wantsShimAlternateFormat(pathname: string, accept: string | null): boolean {
  const jsonLdAccept = (accept ?? "").toLowerCase().includes("application/ld+json");
  return (
    isMarkdownPath(pathname) ||
    isDocLangPath(pathname) ||
    isJsonLdPath(pathname) ||
    prefersMarkdown(accept) ||
    prefersDocLang(accept) ||
    jsonLdAccept
  );
}

/**
 * Live fetchers (ChatGPT-User, Gemini URL context) often send a browser Accept,
 * a wildcard Accept, or no Accept at all. Serving Markdown as text/markdown
 * makes those tools report unsupported content. Honor HTML when they asked for
 * it, and default browser-like classes to origin HTML unless they negotiated
 * Markdown.
 */
export function requestedHtmlPage(pathname: string, accept: string | null): boolean {
  if (wantsAlternateFormat(pathname, accept)) return false;
  return prefersHtml(accept);
}

/** Classes that default to origin HTML unless the visitor asked for Markdown / DocLang / JSON-LD. */
export const HTML_DEFAULT_TRAFFIC_CLASSES = new Set([
  "live_fetch",
  "agentic_browser",
  "custom_framework",
]);

export function shouldPassthroughHtml(input: {
  pathname: string;
  accept: string | null;
  trafficClass?: string | null;
}): boolean {
  if (wantsShimAlternateFormat(input.pathname, input.accept)) return false;
  if (prefersHtml(input.accept)) return true;
  return HTML_DEFAULT_TRAFFIC_CLASSES.has(input.trafficClass ?? "");
}
