export {
  ADN_FETCHBACK_HEADER,
  ADN_HOST_HEADER,
  ADN_SHIM_CAPTURED_HEADER,
  ADN_SHIM_FORMAT_HEADER,
  ADN_SHIM_PATH_HEADER,
  ADN_SHIM_TELEMETRY_PATH,
  ADN_SITE_TOKEN_HEADER,
  SHIM_VERSION,
  ADN_SHIM_VERSION_HEADER,
  ADN_PASSTHROUGH_HEADER,
  compareShimVersions,
  isShimUpdateAvailable,
  SHIM_GATEWAY_TIMEOUT_MS,
  SHIM_TELEMETRY_TIMEOUT_MS,
} from "./constants.js";
export {
  extractShimContext,
  isCfVerifiedBot,
  isFrameworkInternalRequest,
  isMachineTraffic,
  isShimForwardMethod,
  shouldForwardToGateway,
  wantsServedFormat,
  type ShimRequestContext,
} from "./classify.js";
export {
  buildShimHumanTelemetryRequest,
  reportShimHumanPassthrough,
} from "./telemetry.js";
export {
  handleShimRequest,
  isFetchBackRequest,
  isSafeGatewayUrl,
  type ShimConfig,
  type ShimOutcome,
} from "./handler.js";
export { NEXT_MIDDLEWARE_MATCHER, NEXT_MIDDLEWARE_MATCHER_CONFIG } from "./matcher.js";
