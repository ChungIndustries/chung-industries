# cpm-web

The website for the [cpm registry](../cpm-registry), served at
[cpm.chungindustries.com](https://cpm.chungindustries.com): a landing page for the Chung Package
Manager, a searchable package index, and per-package detail pages.

## How it works

A React SPA on the workspace frontend stack (Vite, TanStack Router/Query, Tailwind,
`@workspace/ui` shadcn components), deployed as Cloudflare Worker static assets via
`@cloudflare/vite-plugin`. A thin API worker (`src/worker/`) handles `/api/*` only, proxying
registry data same-origin over a service binding to the `cpm-registry` Worker, so the site needs
neither public DNS nor CORS on the registry and the registry's API contract stays untouched.

- Search is an interim client-side filter over `GET /packages` (`src/package/search.ts`); it
  should switch to the registry's search endpoint when that lands (issue #85).
- Package READMEs are extracted from the published bundle artifact (`src/worker/bundle.ts` is the
  read-side counterpart of the registry's bundle builder) and rendered as escaped plain text,
  since package content is untrusted.

## Domain structure

Following the workspace convention, each domain lives directly under `src/`:

- `src/package/`: registry packages: types, API fetchers, queries, search, cards and detail views
- `src/cli/`: the cpm command line: terminal demo, copyable command blocks, command reference
- `src/routes/`: TanStack Router file routes; `src/integrations/`: third-party client setup
- `src/worker/`: the `/api/*` Cloudflare Worker (proxy + README extraction)

## Developing

Requires the registry Worker for data: `nx dev cpm-registry` in one terminal, `nx dev cpm-web` in
another (the Cloudflare Vite plugin resolves the service binding against the concurrently running
wrangler dev session through the local dev registry).

Tests cover the pure logic (search filtering, bundle parsing, JSend unwrapping): `nx test cpm-web`.
