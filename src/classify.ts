import { wantsShimAlternateFormat } from "./serve-format.js";

export interface ShimRequestContext {
  userAgent: string;
  accept: string;
  pathname: string;
  verifiedBot?: boolean;
  hasSignatureAgent: boolean;
  hasAgentToken: boolean;
}

export function extractShimContext(request: Request, cfVerifiedBot?: boolean): ShimRequestContext {
  return {
    userAgent: request.headers.get("user-agent") ?? "",
    accept: request.headers.get("accept") ?? "",
    pathname: new URL(request.url).pathname,
    verifiedBot: cfVerifiedBot,
    hasSignatureAgent: request.headers.has("signature-agent"),
    hasAgentToken: Boolean(request.headers.get("x-adn-agent-token")),
  };
}

export function isCfVerifiedBot(cf?: Record<string, unknown> | null): boolean {
  if (!cf) return false;
  if (cf.clientBot === true || cf.verifiedBot === true) return true;
  const botManagement = cf.botManagement as { verifiedBot?: boolean } | undefined;
  return botManagement?.verifiedBot === true;
}

/** Next.js flight / Server Action requests must stay on origin. */
export function isFrameworkInternalRequest(request: Request): boolean {
  return (
    request.headers.has("RSC") ||
    request.headers.has("Next-Router-State-Tree") ||
    request.headers.has("Next-Router-Prefetch") ||
    request.headers.has("Next-Action") ||
    request.headers.has("next-action")
  );
}

export function isShimForwardMethod(method: string): boolean {
  const normalized = method.toUpperCase();
  return normalized === "GET" || normalized === "HEAD";
}

/**
 * Cryptographic / platform machine signals only. The bot catalog lives on the
 * gateway — the public shim must not ship UA patterns.
 */
export function isMachineTraffic(ctx: ShimRequestContext): boolean {
  if (ctx.verifiedBot === true) return true;
  if (ctx.hasSignatureAgent) return true;
  if (ctx.hasAgentToken) return true;
  return false;
}

/** Visitor asked for Markdown / DocLang / JSON-LD — serve that format via the gateway. */
export function wantsServedFormat(ctx: ShimRequestContext): boolean {
  return wantsShimAlternateFormat(ctx.pathname, ctx.accept || null);
}

/**
 * Cheap local skip only (method, Next internals). Classification is on the gateway.
 * Bypass paths are handled by the caller.
 */
export function shouldForwardToGateway(ctx: ShimRequestContext, request?: Request): boolean {
  if (request && !isShimForwardMethod(request.method)) return false;
  if (request && isFrameworkInternalRequest(request)) return false;
  return true;
}
