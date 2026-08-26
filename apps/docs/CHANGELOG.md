## 0.0.2 (2026-08-26)

### 🩹 Fixes

- The docs site is actually reachable at https://docs.chungindustries.com: the custom domain route was nested under `[observability]` by TOML table rules, so wrangler ignored it and the domain was never registered. ([126996e](https://github.com/ChungIndustries/chung-industries/commit/126996e))

### ❤️ Thank You

- Christian Mattsson

## 0.0.1 (2026-08-26)

### 🩹 Fixes

- Initial release of the ChungIndustries docs site: a Cloudflare Worker serving the Scalar API reference for the CPM Registry at `/cpm-registry`, with the spec proxied from the registry Worker over a service binding. ([a529410](https://github.com/ChungIndustries/chung-industries/commit/a529410))

### ❤️ Thank You

- Christian Mattsson
- Claude Fable 5