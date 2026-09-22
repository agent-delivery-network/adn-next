# Contributing to `@agent-delivery-network/next`

Thank you. This repository is the **public review copy** of the ADN Next.js / Vercel connector — the code that runs on a customer origin.

## How a change is included

`main` here is a **mirror**. It is overwritten by a sync from the private ADN monorepo. Merging a pull request onto this `main` does not ship to npm and is wiped on the next sync.

1. Open a pull request against this repo. Keep the diff small and describe fail-open impact if you touch `src/handler.ts`.
2. **[Tim Dew](https://github.com/Timbot-42) reviews.** Nothing is included without that approval. First-time GitHub Actions runs on fork PRs also need his approval.
3. If he accepts it, the change is **ported into the private monorepo** (imports rewritten back to workspace packages), tested, and merged there.
4. The next sync updates this tree. npm is published from the private repo, not from here.

**Do not merge** pull requests onto `main`. Please do not ask maintainers to press merge on this repo.

## What belongs in a PR

Edits to the connector that runs on origin: fail-open handling, matcher, cheap skips (POST, Next.js RSC), bypass paths, the HTTPS gateway gate, docs for those files.

## What does not

The gateway bot catalog, intent classification, Cloudflare WAF skip expressions, dashboard, billing, or secrets. Those are not in this package and must not be added.

## Tests

```bash
pnpm install
pnpm test
```

Every failure mode — gateway down, slow, garbage, throw — must return the origin response. Do not forward `Cookie` or `Authorization` to the gateway.
