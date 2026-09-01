# CPM Registry

The official registry service for the Chung Package Manager (CPM), providing a hosted index and tarball storage for ComputerCraft-focused Lua packages. It runs as a Cloudflare Worker using Hono with `@hono/zod-openapi` to expose a typed, documented API that cpm clients call to browse and publish packages.

## What it does

- Hosts CPM package metadata (in D1) and tarballs (in R2) for distribution.
- Validates publish requests and enforces immutable, integrity-checked versions, capped at 5 MiB per tarball (512 KiB extracted).
- Authenticates publishers (GitHub-backed accounts via Better Auth under `/auth/*`, hashed publish tokens for machines) and enforces package ownership: the first authenticated publish claims a name into `package_maintainers`, and only its maintainers can publish later versions. Reads stay public. See [docs/cpm-registry-auth-design.md](../../docs/cpm-registry-auth-design.md).
- Derives a client-facing **bundle** from each published tarball (a length-prefixed JSON manifest plus raw file bytes, served gzip on the wire) so the in-game cpm client never has to gunzip or untar in Lua; see [docs/cpm-client-design.md](../../docs/cpm-client-design.md).
- Resolves dependency ranges server-side (`POST /resolve`) with the canonical `semver` package, pinning one version per package for the client's flat install store.
- Serves the cpm bootstrap installer (`GET /install`) straight out of the latest published `cpm` package: `wget run https://registry.cpm.chungindustries.com/install`.
- Generates an OpenAPI spec (`openapi.yaml`, also served at `GET /openapi.json`) that drives the [`docs`](../docs) site and the Scalar registry entry.

## Architecture

The Worker holds no local state:

- **Package index** lives in **D1** (`DB` binding). The `versions` table's composite primary key `(package_name, version)` enforces version immutability at the storage layer: a re-publish is a constraint violation, surfaced as HTTP 409.
- **Tarball and bundle bytes** live in **R2** (`BUCKET` binding), keyed content-addressably by the tarball's SHA-1 and the bundle's SHA-256 respectively. Downloads are proxied through the Worker with immutable cache headers so the Cloudflare edge serves repeat requests. ([#39](https://github.com/ChungIndustries/chung-industries/issues/39) tracks moving `dist.tarball` to direct public R2 URLs so downloads bypass the Worker entirely.)

Business logic ([`src/components/package/service.ts`](src/components/package/service.ts)) depends on `RegistryStore` and `BlobStore` interfaces; production wires them to D1/R2 adapters, tests wire them to in-memory fakes.

## API documentation

Full HTTP API docs (generated from this codebase) are served by the [`docs`](../docs) app at https://docs.chungindustries.com/cpm-registry. Refer there for endpoints, request/response shapes, and examples. The reference reads this Worker's live `GET /openapi.json` through a service binding, so it always matches the deployed API.

The Release workflow also publishes the committed `openapi.yaml` to the [Scalar registry](https://registry.scalar.com/@chungindustries/apis/cpm-registry), versioned by the release tag, which keeps Scalar features that consume the spec (SDK and MCP generation) available. Scalar's hosted docs site is not used: publishing it is gated behind paid Scalar plans. Each GitHub Release of `cpm-registry` also attaches the released `openapi.yaml` and links the docs.

The spec embeds the version from `package.json` (stamped by the release PR) and CI fails if `openapi.yaml` drifts from the code, so regenerate and commit it whenever you change the API: `pnpm gen-docs`.

## Getting started

1. Install dependencies: `pnpm install`
2. Configuration lives in [`wrangler.toml`](wrangler.toml). The runtime bindings (`DB`, `BUCKET`) are declared there. `wrangler dev` provisions local miniflare D1/R2 automatically. The `Env` type the code uses is generated from `wrangler.toml` into `worker-configuration.d.ts` by `pnpm gen-types`; rerun it (and commit the result) whenever bindings change. Auth needs four secrets, validated in [`src/env.ts`](src/env.ts) and read from a gitignored `.dev.vars` locally (`wrangler secret put` in production): `BETTER_AUTH_SECRET` (any 32+ char random string locally), `BETTER_AUTH_URL`, and `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` from a GitHub OAuth App whose callback is `<BETTER_AUTH_URL>/auth/callback/github`. `BETTER_AUTH_URL` is the **website's** origin, not this Worker's: the cpm-web app proxies `/auth/*` here over its service binding so the whole browser flow stays on one origin (`https://cpm.chungindustries.com` in production, `http://localhost:5173` locally with the cpm-web dev server running alongside `pnpm dev`). Routes that never touch auth work without them.
3. Apply the D1 schema locally: `pnpm db:migrate` (adds migrations under [`migrations/`](migrations)).
4. Run locally: `pnpm dev` (`wrangler dev`, local D1 + R2).
5. Check the Worker bundles: `pnpm build` (`wrangler deploy --dry-run`).
6. Generate the OpenAPI spec: `pnpm gen-docs` (writes `openapi.yaml`).

## Deployment

Deployment is release-gated: merging the release PR runs [`release.yml`](../../.github/workflows/release.yml), and when the release includes cpm-registry (a `cpm-registry@{version}` tag was created), it calls [`deploy-cpm-registry.yml`](../../.github/workflows/deploy-cpm-registry.yml) to apply remote D1 migrations and run `wrangler deploy`. Ordinary merges to `main` do not deploy. For a manual deploy or redeploy of current `main`, run the "Deploy CPM Registry" workflow from the Actions tab (`workflow_dispatch`).

First-time setup (one-off, on your Cloudflare account):

1. `wrangler d1 create cpm-registry` and paste the printed `database_id` into `wrangler.toml`.
2. `wrangler r2 bucket create cpm-registry-tarballs`.
3. Add repository secrets `CLOUDFLARE_API_TOKEN` (Workers Scripts + D1 + R2 edit, plus Workers Routes edit on the `chungindustries.com` zone so deploys can attach the custom domains) and `CLOUDFLARE_ACCOUNT_ID`.
4. Apply migrations and deploy once by hand if you like: `pnpm db:migrate:remote` then `pnpm run deploy` (`run` is required; pnpm's built-in `deploy` command shadows the script).
