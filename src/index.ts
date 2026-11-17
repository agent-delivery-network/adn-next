import {
  fetchShimRemoteConfig,
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
      "@agent-delivery-network/next: gatewayUrl must be HTTPS (http://localhost is allowed for development).",
    );
  }

  const shimConfig: ShimConfig = {
    gatewayUrl: config.gatewayUrl,
    siteToken: config.siteToken,
    gatewayTimeoutMs: config.gatewayTimeoutMs,
  };

  return async function adnMiddleware(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const passthrough = await handleShimRequest(request, shimConfig, () => continueToOrigin());
    if (passthrough.headers.get("x-middleware-next") !== "1") {
      return passthrough;
    }
    const accept = request.headers.get("accept") ?? "";
    if (!accept.includes("text/html")) {
      return passthrough;
    }
    try {
      const remote = await fetchShimRemoteConfig({
        gatewayUrl: shimConfig.gatewayUrl,
        siteToken: shimConfig.siteToken,
        siteHost: url.hostname,
      });
      const discovery = remote?.agentDiscovery;
      const linkValue =
        discovery && discovery.linkHeaderEnabled !== false && discovery.mcpUrl
          ? `<${discovery.mcpUrl}>; rel="mcp"`
          : null;
      if (!linkValue) return passthrough;
      const headers = new Headers(passthrough.headers);
      const existing = headers.get("link");
      headers.set("link", existing ? `${existing}, ${linkValue}` : linkValue);
      return new Response(null, { status: 200, headers });
    } catch {
      return passthrough;
    }
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
