# CPM Registry

The official registry service for the Chung Package Manager (CPM), providing a hosted index and tarball storage for ComputerCraft-focused Lua packages. It runs as a Cloudflare Worker using Hono with `@hono/zod-openapi` to expose a typed, documented API that cpm clients call to browse and publish packages.

## What it does

- Hosts CPM package metadata (in D1) and tarballs (in R2) for distribution.
- Validates publish requests and enforces immutable, integrity-checked versions.
- Generates an OpenAPI/Scalar documentation site for the HTTP API.

## Architecture

The Worker holds no local state:

- **Package index** lives in **D1** (`DB` binding). The `versions` table's composite primary key `(package_name, version)` enforces version immutability at the storage layer: a re-publish is a constraint violation, surfaced as HTTP 409.
- **Tarball bytes** live in **R2** (`BUCKET` binding), keyed content-addressably by the tarball's SHA-1. Downloads are proxied through the Worker with immutable cache headers so the Cloudflare edge serves repeat requests. ([#39](https://github.com/ChungIndustries/chung-industries/issues/39) tracks moving `dist.tarball` to direct public R2 URLs so downloads bypass the Worker entirely.)

Business logic ([`src/components/package/service.ts`](src/components/package/service.ts)) depends on `RegistryStore` and `TarballStore` interfaces; production wires them to D1/R2 adapters, tests wire them to in-memory fakes.

## API documentation

Full HTTP API docs (generated from this codebase) are available at https://chungindustries.apidocumentation.com/cpm-registry. Refer there for endpoints, request/response shapes, and examples. [Source](https://chungindustries.apidocumentation.com/cpm-registry)

These docs are published to Scalar automatically by the Release workflow whenever a new `cpm-registry` version is released (via `scalar registry publish`, versioned by the release tag). The committed `openapi.yaml` is the spec that gets published; CI fails if it drifts from the code, so regenerate and commit it whenever you change the API: `pnpm gen-docs`.

## Getting started

1. Install dependencies: `pnpm install`
2. Configuration lives in [`wrangler.toml`](wrangler.toml). The runtime bindings (`DB`, `BUCKET`) are declared there; there are no `.env` files. `wrangler dev` provisions local miniflare D1/R2 automatically. The `Env` type the code uses is generated from `wrangler.toml` into `worker-configuration.d.ts` by `pnpm gen-types`; rerun it (and commit the result) whenever bindings change.
3. Apply the D1 schema locally: `pnpm db:migrate` (adds migrations under [`migrations/`](migrations)).
4. Run locally: `pnpm dev` (`wrangler dev`, local D1 + R2).
5. Check the Worker bundles: `pnpm build` (`wrangler deploy --dry-run`).
6. Generate the OpenAPI spec: `pnpm gen-docs` (writes `openapi.yaml`).

## Deployment

Deployment is release-gated: merging the release PR runs [`release.yml`](../../.github/workflows/release.yml), and when the release includes cpm-registry (a `cpm-registry@{version}` tag was created), it calls [`deploy-cpm-registry.yml`](../../.github/workflows/deploy-cpm-registry.yml) to apply remote D1 migrations and run `wrangler deploy`. Ordinary merges to `main` do not deploy. For a manual deploy or redeploy of current `main`, run the "Deploy CPM Registry" workflow from the Actions tab (`workflow_dispatch`).

First-time setup (one-off, on your Cloudflare account):

1. `wrangler d1 create cpm-registry` and paste the printed `database_id` into `wrangler.toml`.
2. `wrangler r2 bucket create cpm-registry-tarballs`.
3. Add repository secrets `CLOUDFLARE_API_TOKEN` (Workers Scripts + D1 + R2 edit) and `CLOUDFLARE_ACCOUNT_ID`.
4. Apply migrations and deploy once by hand if you like: `pnpm db:migrate:remote` then `pnpm run deploy` (`run` is required; pnpm's built-in `deploy` command shadows the script).
