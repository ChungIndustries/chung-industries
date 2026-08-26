# ChungIndustries Docs

API documentation site for ChungIndustries services, served by a thin Hono Worker rendering [Scalar](https://scalar.com) API reference UIs. Self-hosted because Scalar's hosted docs publishing is gated behind paid plans.

The CPM Registry reference lives at `/cpm-registry` (the root redirects there). The spec is fetched same-origin and proxied to the `cpm-registry` Worker over a service binding, so the docs always show the deployed API without depending on public DNS or CORS.

Served at https://docs.chungindustries.com, declared as a custom domain in [`wrangler.toml`](wrangler.toml) (DNS record and certificate are created automatically on deploy).

## Getting started

1. Install dependencies: `pnpm install`
2. Run locally: `pnpm dev`. The service binding connects to a local registry automatically when `pnpm --filter cpm-registry dev` runs in another terminal; without it the spec proxy has nothing to talk to.
3. Check the Worker bundles: `pnpm build` (`wrangler deploy --dry-run`).

## Deployment

Deploys ride the release train: a release that includes `docs` triggers [`deploy-docs.yml`](../../.github/workflows/deploy-docs.yml) (see `release.yml`). Manual deploys stay available via that workflow's `workflow_dispatch` trigger.
