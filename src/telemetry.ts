import { resolveServeFormat } from "./serve-format.js";
import {
  ADN_HOST_HEADER,
  ADN_SHIM_FORMAT_HEADER,
  ADN_SHIM_PATH_HEADER,
  ADN_SHIM_TELEMETRY_PATH,
  ADN_SHIM_VERSION_HEADER,
  ADN_SITE_TOKEN_HEADER,
  SHIM_TELEMETRY_TIMEOUT_MS,
  SHIM_VERSION,
} from "./constants.js";
import type { ShimConfig } from "./handler.js";

export function buildShimHumanTelemetryRequest(
  request: Request,
  config: ShimConfig,
): Request {
  const url = new URL(request.url);
  const gatewayBase = config.gatewayUrl.replace(/\/$/, "");
  const telemetryUrl = `${gatewayBase}${ADN_SHIM_TELEMETRY_PATH}${url.search}`;
  const format = resolveServeFormat({
    pathname: url.pathname,
    accept: request.headers.get("accept"),
  });
  const telemetry = new Request(telemetryUrl, {
    method: "GET",
    headers: {
      [ADN_SITE_TOKEN_HEADER]: config.siteToken,
      [ADN_HOST_HEADER]: url.hostname,
      [ADN_SHIM_PATH_HEADER]: url.pathname,
      [ADN_SHIM_FORMAT_HEADER]: format,
      [ADN_SHIM_VERSION_HEADER]: SHIM_VERSION,
    },
  });
  const userAgent = request.headers.get("user-agent");
  if (userAgent) telemetry.headers.set("user-agent", userAgent);
  return telemetry;
}

/** Fire-and-forget human passthrough log — failures are ignored (fail-open). */
export function reportShimHumanPassthrough(
  request: Request,
  config: ShimConfig,
): void {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SHIM_TELEMETRY_TIMEOUT_MS);
  void fetch(buildShimHumanTelemetryRequest(request, config), {
    signal: controller.signal,
  })
    .catch(() => undefined)
    .finally(() => clearTimeout(timer));
}
