---
docs: patch
---

The docs site is actually reachable at https://docs.chungindustries.com: the custom domain route was nested under `[observability]` by TOML table rules, so wrangler ignored it and the domain was never registered.
