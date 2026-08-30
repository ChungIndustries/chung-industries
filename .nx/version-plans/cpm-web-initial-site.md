---
cpm-web: minor
---

Initial release of the cpm registry website at cpm.chungindustries.com: a landing page explaining cpm and how to install it, a searchable package index, and per-package detail pages with versions, dependencies, install commands, and READMEs extracted from the published bundles. A TanStack Start app on the workspace frontend stack (React, TanStack Router/Query, Tailwind, shared shadcn UI), server-rendered on a Cloudflare Worker with registry data fetched in server functions over a service binding to the registry.
