# `@agent-delivery-network/next`

Public source for the ADN Next.js / Vercel connector. Security teams: this is the code that runs on the customer origin. It is deliberately small.

- **Does:** forward GET/HEAD document requests to the ADN gateway, honor `x-adn-passthrough`, fail open to origin on any error.
- **Does not:** classify by intent, ship a bot catalog, apply policy, or extract Markdown. That stays on the ADN gateway.

```bash
npm install @agent-delivery-network/next
```

```ts
// middleware.ts — env vars must be referenced here so Next.js inlines them at build time
import { createAdnMiddleware, config } from "@agent-delivery-network/next";

const adn = createAdnMiddleware({
  gatewayUrl: process.env.ADN_GATEWAY_URL!,
  siteToken: process.env.ADN_SITE_TOKEN!,
});

export function middleware(request: Request) {
  return adn(request);
}

export { config };
```

Keep `config.matcher` restrictive. Vercel bills middleware as Edge Requests.

## Fail-open contract

Every failure mode — gateway down, slow, garbage, throw — must return the origin response.

```bash
pnpm install
pnpm test
```

## Layout

| File | What to read |
| --- | --- |
| `src/index.ts` | Public API (`createAdnMiddleware`, matcher `config`) |
| `src/handler.ts` | Forward / fetch-back / fail-open |
| `src/classify.ts` | Cheap skips (POST, Next.js RSC) — classification is on the gateway |
| `src/matcher.ts` | Restrictive Next.js matcher |
| `src/constants.ts` | Headers and connector version |
| `src/bypass-path.ts` | Paths that never leave origin (`/_next/`, static assets, checkout) |

The npm tarball is a bundled `dist/` of these files. Runtime behaviour must match this source.

## Contributing

Public pull requests are welcome as **proposals**. `main` is a mirror and is overwritten on each sync, so please do not merge PRs here. Inclusion needs [Tim Dew](https://github.com/Timbot-42)’s approval, then a port into the private ADN monorepo. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Not in this repo

Gateway, classifier, dashboard, Cloudflare Snippet installer, and billing live in the private ADN app repo. The Cloudflare Snippet is a generated string with the same fail-open contract; it is not this package.
