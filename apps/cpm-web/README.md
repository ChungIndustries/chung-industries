# cpm-web

The website for the [cpm registry](../cpm-registry), served at
[cpm.chungindustries.com](https://cpm.chungindustries.com): a landing page for the Chung Package
Manager, a searchable package index, and per-package detail pages.

## How it works

A TanStack Start app on the workspace frontend stack (React, TanStack Router/Query, Tailwind,
`@workspace/ui` shadcn components), server-rendered on a Cloudflare Worker via
`@cloudflare/vite-plugin` (the [official hosting setup](https://tanstack.com/start/latest/docs/framework/react/guide/hosting#cloudflare-workers-official-partner)).
Registry data is fetched in server functions (`src/package/server.ts`) over a service binding to
the `cpm-registry` Worker, so the site needs neither public DNS nor CORS on the registry and the
registry's API contract stays untouched. SSR also gives every page real titles and meta tags via
route `head()` options.

- Search is an interim client-side filter over the full package list (`src/package/search.ts`); it
  should switch to the registry's search endpoint when that lands (issue #85).
- Package READMEs are extracted from the published bundle artifact (`src/package/bundle.ts` is the
  read-side counterpart of the registry's bundle builder) and rendered as escaped plain text,
  since package content is untrusted.
- `src/cloudflare-workers.d.ts` types the `cloudflare:workers` env import structurally (the full
  `@cloudflare/workers-types` globals clash with the DOM lib); keep it in sync with the bindings
  in `wrangler.toml`.

## Domain structure

Following the workspace convention, each domain lives directly under `src/`:

- `src/package/`: registry packages: types, server functions, queries, search, bundle parsing,
  cards and detail views
- `src/cli/`: the cpm command line: terminal demo, copyable command blocks, command reference
- `src/routes/`: TanStack Router file routes; `src/router.tsx`: the Start router factory

## Developing

Requires the registry Worker for data: `nx dev cpm-registry` in one terminal, `nx dev cpm-web` in
another (the Cloudflare Vite plugin resolves the service binding against the concurrently running
wrangler dev session through the local dev registry).

Tests cover the pure logic (search filtering, bundle parsing, JSend unwrapping): `nx test cpm-web`.
