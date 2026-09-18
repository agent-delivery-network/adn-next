import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  extractShimContext,
  handleShimRequest,
  isFrameworkInternalRequest,
  isMachineTraffic,
  isSafeGatewayUrl,
  isShimForwardMethod,
  SHIM_VERSION,
  shouldForwardToGateway,
  wantsServedFormat,
} from "../src/shared.js";
import { isBypassPath } from "../src/bypass-path.js";

const GATEWAY_URL = "https://gw.adn.example";
const SITE_TOKEN = "test-token";

function makeRequest(overrides: {
  ua?: string;
  accept?: string;
  path?: string;
  method?: string;
  headers?: Record<string, string>;
} = {}): Request {
  const url = `https://customer.com${overrides.path ?? "/page"}`;
  const headers = new Headers(overrides.headers);
  if (overrides.ua) headers.set("user-agent", overrides.ua);
  if (overrides.accept) headers.set("accept", overrides.accept);
  return new Request(url, { method: overrides.method ?? "GET", headers });
}

describe("isMachineTraffic", () => {
  it("treats verified bots as machine", () => {
    const ctx = extractShimContext(makeRequest(), true);
    expect(isMachineTraffic(ctx)).toBe(true);
  });

  it("treats Signature-Agent and agent tokens as machine", () => {
    expect(
      isMachineTraffic(
        extractShimContext(makeRequest({ headers: { "signature-agent": "https://bot.example" } })),
      ),
    ).toBe(true);
    expect(
      isMachineTraffic(
        extractShimContext(makeRequest({ headers: { "x-adn-agent-token": "adn_agent_abc" } })),
      ),
    ).toBe(true);
  });

  it("does not classify from user-agent strings", () => {
    expect(isMachineTraffic(extractShimContext(makeRequest({ ua: "GPTBot/1.0" })))).toBe(false);
    expect(isMachineTraffic(extractShimContext(makeRequest({ ua: "Googlebot/2.1" })))).toBe(false);
    expect(isMachineTraffic(extractShimContext(makeRequest({ ua: "curl/8.0" })))).toBe(false);
    expect(
      isMachineTraffic(extractShimContext(makeRequest({ ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X)" }))),
    ).toBe(false);
  });

  it("does not treat format negotiation as machine identity", () => {
    const ctx = extractShimContext(
      makeRequest({ ua: "Mozilla/5.0 Safari", accept: "text/markdown" }),
    );
    expect(isMachineTraffic(ctx)).toBe(false);
    expect(wantsServedFormat(ctx)).toBe(true);
  });
});

describe("shouldForwardToGateway", () => {
  it("forwards ordinary GET document requests for the gateway to classify", () => {
    const request = makeRequest({ ua: "Mozilla/5.0 Safari" });
    expect(shouldForwardToGateway(extractShimContext(request), request)).toBe(true);
    expect(shouldForwardToGateway(extractShimContext(makeRequest({ ua: "curl/8.0" })), makeRequest({ ua: "curl/8.0" }))).toBe(true);
    expect(shouldForwardToGateway(extractShimContext(makeRequest({ ua: "GPTBot/1.0" })), makeRequest({ ua: "GPTBot/1.0" }))).toBe(true);
  });

  it("skips POST and Next.js internals", () => {
    const post = makeRequest({ method: "POST", ua: "Mozilla/5.0 Safari" });
    expect(isShimForwardMethod("POST")).toBe(false);
    expect(shouldForwardToGateway(extractShimContext(post), post)).toBe(false);

    const rsc = makeRequest({ headers: { RSC: "1" } });
    expect(isFrameworkInternalRequest(rsc)).toBe(true);
    expect(shouldForwardToGateway(extractShimContext(rsc), rsc)).toBe(false);
  });
});

describe("handleShimRequest fail-open", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const config = { gatewayUrl: GATEWAY_URL, siteToken: SITE_TOKEN, gatewayTimeoutMs: 100 };

  it("asks the gateway to classify browsers and fail-opens on passthrough", async () => {
    const request = makeRequest({ ua: "Mozilla/5.0 Safari" });
    const originResponse = new Response("origin", { status: 200 });
    const fetchOrigin = vi.fn().mockResolvedValue(originResponse);

    vi.mocked(fetch).mockResolvedValue(
      new Response(null, {
        status: 204,
        headers: { "x-adn-passthrough": "1" },
      }),
    );

    const response = await handleShimRequest(request, config, fetchOrigin);

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    const forwarded = vi.mocked(fetch).mock.calls[0]?.[0] as Request;
    expect(forwarded.url).toContain("/page");
    expect(forwarded.url).not.toContain("adn-shim-telemetry");
    expect(forwarded.headers.get("x-adn-shim-captured")).toBe("1");
    expect(forwarded.headers.get("x-adn-shim-version")).toBe(SHIM_VERSION);
    expect(fetchOrigin).toHaveBeenCalledWith(request);
    expect(await response.text()).toBe("origin");
  });

  it("does not send a separate human telemetry ping", async () => {
    const request = makeRequest({ ua: "Mozilla/5.0 Safari" });
    const fetchOrigin = vi.fn().mockResolvedValue(new Response("origin", { status: 200 }));
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, { status: 204, headers: { "x-adn-passthrough": "1" } }),
    );

    await handleShimRequest(request, config, fetchOrigin);

    for (const [input] of vi.mocked(fetch).mock.calls) {
      const url = input instanceof Request ? input.url : String(input);
      expect(url).not.toContain("/.well-known/adn-shim-telemetry");
    }
  });

  it("fail-opens to origin when gateway signals shim passthrough", async () => {
    const request = makeRequest({ ua: "Googlebot/2.1" });
    const fetchOrigin = vi.fn().mockResolvedValue(new Response("origin", { status: 200 }));

    vi.mocked(fetch).mockResolvedValue(
      new Response(null, {
        status: 204,
        headers: { "x-adn-passthrough": "1" },
      }),
    );

    const response = await handleShimRequest(request, config, fetchOrigin);

    expect(fetchOrigin).toHaveBeenCalledWith(request);
    expect(await response.text()).toBe("origin");
  });

  it("forwards curl for the gateway to classify", async () => {
    const request = makeRequest({ ua: "curl/8.0" });
    const fetchOrigin = vi.fn().mockResolvedValue(new Response("origin", { status: 200 }));
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, { status: 204, headers: { "x-adn-passthrough": "1" } }),
    );

    const response = await handleShimRequest(request, config, fetchOrigin);

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(fetchOrigin).toHaveBeenCalledWith(request);
    expect(await response.text()).toBe("origin");
  });

  it("does not forward POST or Next.js RSC requests", async () => {
    const fetchOrigin = vi.fn().mockResolvedValue(new Response("origin", { status: 200 }));
    const post = makeRequest({ method: "POST", ua: "GPTBot/1.0" });
    await handleShimRequest(post, config, fetchOrigin);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();

    const rsc = makeRequest({ ua: "Mozilla/5.0 Safari", headers: { RSC: "1" } });
    await handleShimRequest(rsc, config, fetchOrigin);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(fetchOrigin).toHaveBeenCalledTimes(2);
  });

  it("fail-opens to origin when gateway returns 500", async () => {
    const request = makeRequest({ ua: "GPTBot/1.0" });
    const originResponse = new Response("origin", { status: 200 });
    const fetchOrigin = vi.fn().mockResolvedValue(originResponse);

    vi.mocked(fetch).mockResolvedValue(new Response("error", { status: 500 }));

    const response = await handleShimRequest(request, config, fetchOrigin);

    expect(fetchOrigin).toHaveBeenCalledWith(request);
    expect(await response.text()).toBe("origin");
  });

  it("fail-opens to origin when gateway returns garbage empty body", async () => {
    const request = makeRequest({ ua: "GPTBot/1.0" });
    const fetchOrigin = vi.fn().mockResolvedValue(new Response("origin", { status: 200 }));

    vi.mocked(fetch).mockResolvedValue(
      new Response("", {
        status: 200,
        headers: { "content-type": "text/html", "content-length": "0" },
      }),
    );

    const response = await handleShimRequest(request, config, fetchOrigin);

    expect(fetchOrigin).toHaveBeenCalledWith(request);
    expect(await response.text()).toBe("origin");
  });

  it("fail-opens to origin when gateway times out", async () => {
    const request = makeRequest({ ua: "GPTBot/1.0" });
    const fetchOrigin = vi.fn().mockResolvedValue(new Response("origin", { status: 200 }));
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise((_, reject) => {
          const error = new Error("aborted");
          error.name = "AbortError";
          setTimeout(() => reject(error), 5);
        }),
    );

    const response = await handleShimRequest(
      request,
      { ...config, gatewayTimeoutMs: 1 },
      fetchOrigin,
    );

    expect(fetchOrigin).toHaveBeenCalledWith(request);
    expect(await response.text()).toBe("origin");
  });

  it("fail-opens to origin when gateway fetch throws", async () => {
    const request = makeRequest({ ua: "GPTBot/1.0" });
    const fetchOrigin = vi.fn().mockResolvedValue(new Response("origin", { status: 200 }));
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));

    const response = await handleShimRequest(request, config, fetchOrigin);

    expect(fetchOrigin).toHaveBeenCalledWith(request);
    expect(await response.text()).toBe("origin");
  });

  it("returns gateway response when valid", async () => {
    const request = makeRequest({ ua: "GPTBot/1.0" });
    const fetchOrigin = vi.fn();

    vi.mocked(fetch).mockResolvedValue(
      new Response("# Hello", {
        status: 200,
        headers: { "content-type": "text/markdown" },
      }),
    );

    const response = await handleShimRequest(request, config, fetchOrigin);

    expect(fetchOrigin).not.toHaveBeenCalled();
    expect(await response.text()).toBe("# Hello");
  });

  it("forwards markdown Accept from a browser to the gateway", async () => {
    const request = makeRequest({ ua: "Mozilla/5.0 Safari", accept: "text/markdown" });
    const fetchOrigin = vi.fn();
    vi.mocked(fetch).mockResolvedValue(
      new Response("# Hello", {
        status: 200,
        headers: { "content-type": "text/markdown" },
      }),
    );

    const response = await handleShimRequest(request, config, fetchOrigin);

    expect(isMachineTraffic(extractShimContext(request))).toBe(false);
    expect(fetchOrigin).not.toHaveBeenCalled();
    expect(await response.text()).toBe("# Hello");
  });

  it("does not send telemetry for static asset paths", async () => {
    const request = makeRequest({
      ua: "Mozilla/5.0 Safari",
      path: "/_next/static/chunks/app.js",
    });
    const fetchOrigin = vi.fn().mockResolvedValue(new Response("asset", { status: 200 }));

    await handleShimRequest(request, config, fetchOrigin);

    expect(isBypassPath("/_next/static/chunks/app.js")).toBe(true);
    expect(fetchOrigin).toHaveBeenCalledWith(request);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("passes fetch-back requests to origin", async () => {
    const request = new Request("https://customer.com/page", {
      headers: {
        "x-adn-fetchback": "1",
        "x-adn-site-token": SITE_TOKEN,
      },
    });
    const fetchOrigin = vi.fn().mockResolvedValue(new Response("origin", { status: 200 }));

    await handleShimRequest(request, config, fetchOrigin);

    expect(fetchOrigin).toHaveBeenCalledWith(request);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("strips cookies and authorization before forwarding to the gateway", async () => {
    const request = new Request("https://customer.com/page", {
      headers: {
        "user-agent": "GPTBot/1.0",
        cookie: "session=super-secret",
        authorization: "Bearer user-jwt",
        "x-adn-agent-token": "adn_agent_abc",
        signature: "sig1=:abc:",
        "signature-input": "sig1=(\"@method\")",
        "signature-agent": "https://bot.example",
      },
    });
    const fetchOrigin = vi.fn();
    vi.mocked(fetch).mockResolvedValue(
      new Response("# Hello", { status: 200, headers: { "content-type": "text/markdown" } }),
    );

    await handleShimRequest(request, config, fetchOrigin);

    const forwarded = vi.mocked(fetch).mock.calls[0]?.[0] as Request;
    expect(forwarded.headers.get("cookie")).toBeNull();
    expect(forwarded.headers.get("authorization")).toBeNull();
    expect(forwarded.headers.get("x-adn-agent-token")).toBe("adn_agent_abc");
    expect(forwarded.headers.get("signature")).toBe("sig1=:abc:");
    expect(forwarded.headers.get("signature-input")).toBe("sig1=(\"@method\")");
    expect(forwarded.headers.get("signature-agent")).toBe("https://bot.example");
    expect(fetchOrigin).not.toHaveBeenCalled();
  });

  it("strips Set-Cookie from gateway responses", async () => {
    const request = makeRequest({ ua: "GPTBot/1.0" });
    const fetchOrigin = vi.fn();
    vi.mocked(fetch).mockResolvedValue(
      new Response("# Hello", {
        status: 200,
        headers: {
          "content-type": "text/markdown",
          "set-cookie": "adn=evil; Path=/",
        },
      }),
    );

    const response = await handleShimRequest(request, config, fetchOrigin);

    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.text()).toBe("# Hello");
  });

  it("asks the gateway to classify generic application/json Accept", async () => {
    const request = makeRequest({ ua: "Mozilla/5.0 Safari", accept: "application/json" });
    const fetchOrigin = vi.fn().mockResolvedValue(new Response("origin", { status: 200 }));
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, { status: 204, headers: { "x-adn-passthrough": "1" } }),
    );

    const response = await handleShimRequest(request, config, fetchOrigin);

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(fetchOrigin).toHaveBeenCalledWith(request);
    expect(await response.text()).toBe("origin");
  });

  it("forwards browser application/ld+json Accept to the gateway", async () => {
    const request = makeRequest({ ua: "Mozilla/5.0 Safari", accept: "application/ld+json" });
    const fetchOrigin = vi.fn();
    vi.mocked(fetch).mockResolvedValue(
      new Response("{}", { status: 200, headers: { "content-type": "application/ld+json" } }),
    );

    const response = await handleShimRequest(request, config, fetchOrigin);

    expect(fetchOrigin).not.toHaveBeenCalled();
    expect(await response.text()).toBe("{}");
  });

  it("fail-opens to origin when gatewayUrl is not HTTPS", async () => {
    const request = makeRequest({ ua: "GPTBot/1.0" });
    const fetchOrigin = vi.fn().mockResolvedValue(new Response("origin", { status: 200 }));

    const response = await handleShimRequest(
      request,
      { gatewayUrl: "http://evil.example", siteToken: SITE_TOKEN },
      fetchOrigin,
    );

    expect(fetchOrigin).toHaveBeenCalledWith(request);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(await response.text()).toBe("origin");
  });
});

describe("isSafeGatewayUrl", () => {
  it("allows HTTPS and local HTTP", () => {
    expect(isSafeGatewayUrl("https://gateway.agent-delivery.network")).toBe(true);
    expect(isSafeGatewayUrl("https://agents.example.com")).toBe(true);
    expect(isSafeGatewayUrl("http://localhost:8787")).toBe(true);
    expect(isSafeGatewayUrl("http://127.0.0.1:8787")).toBe(true);
  });

  it("rejects cleartext remote URLs and credentials", () => {
    expect(isSafeGatewayUrl("http://gateway.agent-delivery.network")).toBe(false);
    expect(isSafeGatewayUrl("https://user:pass@gateway.example")).toBe(false);
    expect(isSafeGatewayUrl("not-a-url")).toBe(false);
  });
});
