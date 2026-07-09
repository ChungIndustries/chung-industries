## 0.0.1 (2026-07-09)

### 🚀 Features

- Make published versions immutable: re-publishing a version that already exists now returns 409 and never overwrites the stored tarball. ([6adb323](https://github.com/ChungIndustries/chung-industries/commit/6adb323))
- Add a tarball download endpoint (`GET /packages/:name/:version/dist/tarball`) that serves the gzipped tarball for a published version, completing the publish/download loop. ([6adb323](https://github.com/ChungIndustries/chung-industries/commit/6adb323))
- Record tarball integrity on publish: each version's `dist` now carries `shasum` (SHA-1) and `integrity` (sha512 SRI), so clients can verify downloaded tarballs. ([6adb323](https://github.com/ChungIndustries/chung-industries/commit/6adb323))
- Re-platform the registry onto Cloudflare Workers (Hono + `@hono/zod-openapi`), storing package metadata in D1 and tarball bytes in R2. The HTTP API, JSend envelopes, and integrity/immutability guarantees are unchanged; the service now runs serverless with no local disk or long-running server. ([#39](https://github.com/ChungIndustries/chung-industries/issues/39))
- Add npm-style `dist-tags` to package metadata, exposing a `latest` tag that resolves to the highest published stable version. ([6adb323](https://github.com/ChungIndustries/chung-industries/commit/6adb323))

### ❤️ Thank You

- Christian Mattsson
- Claude Fable 5
- Claude Opus 4.8