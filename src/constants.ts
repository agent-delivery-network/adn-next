export const ADN_SITE_TOKEN_HEADER = "x-adn-site-token";
export const ADN_HOST_HEADER = "x-adn-host";
export const ADN_FETCHBACK_HEADER = "x-adn-fetchback";
/** Set by Rung 2 shims so the gateway can distinguish shim-captured traffic. */
export const ADN_SHIM_CAPTURED_HEADER = "x-adn-shim-captured";

/** Original request path for human passthrough telemetry (telemetry URL path is not the page). */
export const ADN_SHIM_PATH_HEADER = "x-adn-shim-path";

/** Requested/served format hint on shim telemetry (`html` | `markdown` | `doclang` | `json` | `other`). */
export const ADN_SHIM_FORMAT_HEADER = "x-adn-shim-format";

/** Version baked into generated Cloudflare Snippets and Next.js middleware. */
export const SHIM_VERSION = "2026.09.19";

/** Sent on shim forwards so the gateway can record the installed connector version. */
export const ADN_SHIM_VERSION_HEADER = "x-adn-shim-version";

/** Set on cheap shim passthrough so the connector fetches origin instead of following a 302. */
export const ADN_PASSTHROUGH_HEADER = "x-adn-passthrough";

function versionParts(value: string): number[] {
  return value.split(/[.+-]/).map((part) => {
    const n = Number.parseInt(part, 10);
    return Number.isFinite(n) ? n : 0;
  });
}

/** Negative if `a` is older than `b`. */
export function compareShimVersions(a: string, b: string): number {
  const left = versionParts(a);
  const right = versionParts(b);
  const len = Math.max(left.length, right.length);
  for (let i = 0; i < len; i += 1) {
    const lv = left[i] ?? 0;
    const rv = right[i] ?? 0;
    if (lv !== rv) return lv < rv ? -1 : 1;
  }
  return 0;
}

/** True when the installed connector is missing or older than the current `SHIM_VERSION`. */
export function isShimUpdateAvailable(
  installedVersion: string | null | undefined,
  currentVersion: string = SHIM_VERSION,
): boolean {
  const installed = installedVersion?.trim() ?? "";
  if (!installed) return true;
  return compareShimVersions(installed, currentVersion) < 0;
}

/** Gateway path for fire-and-forget human passthrough telemetry from edge connectors. */
export const ADN_SHIM_TELEMETRY_PATH = "/.well-known/adn-shim-telemetry";

/** Short timeout for non-blocking shim human telemetry — must not delay origin response. */
export const SHIM_TELEMETRY_TIMEOUT_MS = 500;

/** Default gateway forward timeout — fail-open to origin after this. */
export const SHIM_GATEWAY_TIMEOUT_MS = 3_000;
