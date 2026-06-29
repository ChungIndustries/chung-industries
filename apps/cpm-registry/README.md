# CPM Registry

The official registry service for the Chung Package Manager (CPM), providing a hosted index and tarball storage for ComputerCraft-focused Lua packages. It uses Express with express-zod-api to expose a typed, documented API that cpm clients call to browse and publish packages.

## What it does

- Hosts CPM package metadata and tarballs for distribution.
- Validates publish requests to keep registry data consistent.
- Generates an OpenAPI/Scalar documentation site for the HTTP API.
- Designed to run as a small service with file-backed storage.

## API documentation

Full HTTP API docs (generated from this codebase) are available at https://chungindustries.apidocumentation.com/cpm-registry. Refer there for endpoints, request/response shapes, and examples. [Source](https://chungindustries.apidocumentation.com/cpm-registry)

## Getting started

1. Install dependencies: `npm install`
2. Configure environment (selected via `NODE_ENV`: `.env.dev`, `.env.test`, `.env.prod`):
   - `HOSTNAME` (e.g. `0.0.0.0`)
   - `PORT` (e.g. `3000`)
   - `STORAGE_DIR` for tarballs and `registry.json`
3. Run: dev `npm run dev`; build `npm run build`; prod (after build) `npm start`
4. Generate OpenAPI spec: `npm run gen-docs` (writes `openapi.yaml` by default).
