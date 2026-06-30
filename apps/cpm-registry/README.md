# CPM Registry

The official registry service for the Chung Package Manager (CPM), providing a hosted index and tarball storage for ComputerCraft-focused Lua packages. It uses Express with express-zod-api to expose a typed, documented API that cpm clients call to browse and publish packages.

## What it does

- Hosts CPM package metadata and tarballs for distribution.
- Validates publish requests to keep registry data consistent.
- Generates an OpenAPI/Scalar documentation site for the HTTP API.
- Designed to run as a small service with file-backed storage.

## API documentation

Full HTTP API docs (generated from this codebase) are available at https://chungindustries.apidocumentation.com/cpm-registry. Refer there for endpoints, request/response shapes, and examples. [Source](https://chungindustries.apidocumentation.com/cpm-registry)

These docs are published to Scalar automatically by the Release workflow whenever a new `cpm-registry` version is released (via `scalar registry publish`, versioned by the release tag). The committed `openapi.yaml` is the spec that gets published.

## Getting started

1. Install dependencies: `pnpm install`
2. Configure environment. Vars are declared, defaulted, and validated in [`src/env.ts`](src/env.ts):
   - `HOST` (default `0.0.0.0`)
   - `PORT` (default `3000`)
   - `STORAGE_DIR` for tarballs and `registry.json` (default `storage`)

   The committed `.env` holds public defaults. Override per environment with `.env.<NODE_ENV>` (e.g. `.env.production`) and keep secrets in a gitignored `.env.local`. Files are loaded by `dotenv-flow` based on `NODE_ENV`; real process env always wins.

3. Run: dev `pnpm dev`; build `pnpm build`; prod (after build) `pnpm start`
4. Generate OpenAPI spec: `pnpm gen-docs` (writes `openapi.yaml` by default). The committed `openapi.yaml` is the source of truth for the hosted docs; CI fails if it drifts from the code, so regenerate and commit it whenever you change the API.
