/** Paths that should never enter the render pipeline (Week 3 guardrails). */
const DEFAULT_BYPASS_PREFIXES = [
  "/api/",
  "/_next/",
  "/static/",
  "/assets/",
  "/admin/",
  "/auth/",
  "/login",
  "/logout",
  "/checkout",
  "/cart",
  "/account",
] as const;

const DEFAULT_BYPASS_EXTENSIONS = [
  ".js",
  ".css",
  ".map",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".mp4",
  ".webm",
  ".pdf",
  ".zip",
] as const;

function matchesBypassPrefix(pathname: string, prefix: string): boolean {
  if (prefix.endsWith("/")) return pathname.startsWith(prefix);
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isBypassPath(pathname: string, extraPrefixes: string[] = []): boolean {
  const lower = pathname.toLowerCase();
  const prefixes = [...DEFAULT_BYPASS_PREFIXES, ...extraPrefixes];
  if (prefixes.some((p) => matchesBypassPrefix(lower, p.toLowerCase()))) return true;
  return DEFAULT_BYPASS_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
