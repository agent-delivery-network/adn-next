import {
  handleShimRequest,
  isSafeGatewayUrl,
  NEXT_MIDDLEWARE_MATCHER_CONFIG as SHARED_MATCHER_CONFIG,
  SHIM_VERSION as SHARED_SHIM_VERSION,
  type ShimConfig,
} from "./shared.js";

export interface AdnMiddlewareConfig {
  gatewayUrl: string;
  siteToken: string;
  gatewayTimeoutMs?: number;
}

/**
 * Same origin-continue signal as `NextResponse.next()` (`x-middleware-next: 1`).
 * Implemented without importing `next/server` so the published ESM can load
 * in pack checks and does not bundle Next.
 */
function continueToOrigin(): Response {
  return new Response(null, {
    status: 200,
    headers: { "x-middleware-next": "1" },
  });
}

export function createAdnMiddleware(config: AdnMiddlewareConfig) {
  if (!isSafeGatewayUrl(config.gatewayUrl)) {
    throw new Error(
      "@adn/next: gatewayUrl must be HTTPS (http://localhost is allowed for development).",
    );
  }

  const shimConfig: ShimConfig = {
    gatewayUrl: config.gatewayUrl,
    siteToken: config.siteToken,
    gatewayTimeoutMs: config.gatewayTimeoutMs,
  };

  return async function adnMiddleware(request: Request): Promise<Response> {
    return handleShimRequest(request, shimConfig, () => continueToOrigin());
  };
}

/**
 * Restrictive Next.js matcher — keep this on `export const config` so Vercel
 * does not bill static assets as Edge Requests.
 */
export const config: { matcher: string[] } = {
  matcher: [...SHARED_MATCHER_CONFIG.matcher],
};

/** Same matcher object under the shared name used in docs. */
export const NEXT_MIDDLEWARE_MATCHER_CONFIG = config;

/** Connector version reported to the gateway (`x-adn-shim-version`). */
export const SHIM_VERSION: string = SHARED_SHIM_VERSION;
