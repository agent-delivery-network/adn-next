import {
  ADN_FETCHBACK_HEADER,
  ADN_HOST_HEADER,
  ADN_PASSTHROUGH_HEADER,
  ADN_SHIM_CAPTURED_HEADER,
  ADN_SHIM_VERSION_HEADER,
  ADN_SITE_TOKEN_HEADER,
  SHIM_GATEWAY_TIMEOUT_MS,
  SHIM_VERSION,
} from "./constants.js";
import { isBypassPath } from "./bypass-path.js";
import { isFrameworkInternalRequest, isShimForwardMethod } from "./classify.js";

export interface ShimConfig {
  gatewayUrl: string;
  siteToken: string;
  /** Cloudflare Snippets allow only one fetch(request) — use single-origin path. */
  singleOriginFetch?: boolean;
  gatewayTimeoutMs?: number;
}

export interface ShimOutcome {
  action: "passthrough" | "gateway" | "fetchback";
  response?: Response;
}

const CREDENTIAL_REQUEST_HEADERS = ["cookie", "authorization", "proxy-authorization"] as const;
const COOKIE_RESPONSE_HEADERS = ["set-cookie", "set-cookie2"] as const;

function isLocalGatewayHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

/** HTTPS gateways only; http://localhost is allowed for local development. */
export function isSafeGatewayUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.username || url.password) return false;
    if (url.protocol === "https:") return true;
    if (url.protocol === "http:" && isLocalGatewayHost(url.hostname)) return true;
    return false;
  } catch {
    return false;
  }
}

function stripCredentialHeaders(headers: Headers): void {
  for (const name of CREDENTIAL_REQUEST_HEADERS) {
    headers.delete(name);
  }
}

export function sanitizeGatewayResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const name of COOKIE_RESPONSE_HEADERS) {
    headers.delete(name);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function buildGatewayRequest(request: Request, config: ShimConfig): Request {
  const url = new URL(request.url);
  const gatewayBase = config.gatewayUrl.replace(/\/$/, "");
  const forwarded = new Request(`${gatewayBase}${url.pathname}${url.search}`, request);
  stripCredentialHeaders(forwarded.headers);
  forwarded.headers.set(ADN_SITE_TOKEN_HEADER, config.siteToken);
  forwarded.headers.set(ADN_HOST_HEADER, url.hostname);
  forwarded.headers.set(ADN_SHIM_CAPTURED_HEADER, "1");
  forwarded.headers.set(ADN_SHIM_VERSION_HEADER, SHIM_VERSION);
  return forwarded;
}

async function fetchGatewayWithTimeout(
  request: Request,
  config: ShimConfig,
): Promise<Response> {
  const timeoutMs = config.gatewayTimeoutMs ?? SHIM_GATEWAY_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(buildGatewayRequest(request, config), { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isValidGatewayResponse(response: Response): boolean {
  if (response.headers.get(ADN_PASSTHROUGH_HEADER) === "1") return false;
  if (!response.ok || response.status >= 500) return false;
  const ct = response.headers.get("content-type") ?? "";
  if (!ct) return false;
  if (response.headers.get("content-length") === "0") return false;
  return true;
}

/** Fetch-back: gateway asks customer's edge to pull origin content. */
export function isFetchBackRequest(request: Request, siteToken: string): boolean {
  return (
    request.headers.get(ADN_FETCHBACK_HEADER) === "1" &&
    request.headers.get(ADN_SITE_TOKEN_HEADER) === siteToken
  );
}

type FetchOrigin = (req: Request) => Response | Promise<Response>;

/**
 * Core shim handler — every error path must end in origin passthrough.
 * Used by Next.js middleware; Cloudflare Snippet uses generated variant.
 */
export async function handleShimRequest(
  request: Request,
  config: ShimConfig,
  fetchOrigin: FetchOrigin = (req) => fetch(req),
  cfVerifiedBot?: boolean,
): Promise<Response> {
  void cfVerifiedBot;
  try {
    if (isFetchBackRequest(request, config.siteToken)) {
      return fetchOrigin(request);
    }

    if (!isSafeGatewayUrl(config.gatewayUrl)) {
      return fetchOrigin(request);
    }

    const pathname = new URL(request.url).pathname;
    if (isBypassPath(pathname)) {
      return fetchOrigin(request);
    }
    if (!isShimForwardMethod(request.method) || isFrameworkInternalRequest(request)) {
      return fetchOrigin(request);
    }

    const gatewayResponse = await fetchGatewayWithTimeout(request, config);
    if (isValidGatewayResponse(gatewayResponse)) {
      return sanitizeGatewayResponse(gatewayResponse);
    }

    return fetchOrigin(request);
  } catch {
    return fetchOrigin(request);
  }
}

export { fetchGatewayWithTimeout, isValidGatewayResponse };
