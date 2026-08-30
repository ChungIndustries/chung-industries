---
cpm-web: minor
---

Initial release of the cpm registry website at cpm.chungindustries.com: a landing page explaining cpm and how to install it, a searchable package index, and per-package detail pages with versions, dependencies, install commands, and READMEs extracted from the published bundles. Built on the workspace frontend stack (React, TanStack Router/Query, Tailwind, shared shadcn UI) and served as Cloudflare Worker static assets with a thin same-origin API proxy over a service binding to the registry.
