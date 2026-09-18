/**
 * Restrictive Next.js middleware matcher — avoids billing static assets as Edge Requests.
 * See PLAN.md Week 3 and risk R11.
 */
export const NEXT_MIDDLEWARE_MATCHER = [
  "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:js|css|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|mp4|webm|pdf|zip|map)$).*)",
] as const;

export const NEXT_MIDDLEWARE_MATCHER_CONFIG = {
  matcher: [...NEXT_MIDDLEWARE_MATCHER],
} as const;
