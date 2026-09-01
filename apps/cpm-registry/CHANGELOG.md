## 0.0.7 (2026-09-01)

### 🩹 Fixes

- Publish tokens now require a name at creation, so the account page's token inventory stays a readable machine-by-machine list. ([a4f4357](https://github.com/ChungIndustries/chung-industries/commit/a4f4357))

### ❤️ Thank You

- Christian Mattsson
- Claude Fable 5

## 0.0.6 (2026-08-31)

### 🚀 Features

- Package responses now expose publish timestamps: `createdAt` on each version and on the package itself (first publish). The website renders them as a relative "published X ago" in the package index rows and in each package's versions list. ([#123](https://github.com/ChungIndustries/chung-industries/issues/123), [#122](https://github.com/ChungIndustries/chung-industries/issues/122))
- Packages can now declare an optional `description` in their `cpm.json` manifest, stating what the package does. The registry validates and stores it at publish and returns it in package responses, and the website shows it under the package name in search results and on package pages, with search matching against it. ([#123](https://github.com/ChungIndustries/chung-industries/issues/123), [#122](https://github.com/ChungIndustries/chung-industries/issues/122))

### ❤️ Thank You

- Christian Mattsson
- Claude Fable 5

## 0.0.5 (2026-08-27)

### 🩹 Fixes

- Fixes GitHub sign-in failing with `internal_server_error`: better-auth 1.7 expects an `account.issuer` column that the 1.6-generated schema lacked. Adds the missing column and unique index as an additive migration, and pins `better-auth` and `@better-auth/api-key` to exact versions so the runtime and committed schema can no longer drift apart. ([6f59c6f](https://github.com/ChungIndustries/chung-industries/commit/6f59c6f))

### ❤️ Thank You

- Christian Mattsson
- Claude Fable 5

## 0.0.4 (2026-08-27)

### 🚀 Features

- Publishing now requires an account: `POST /packages` takes a publish-scoped token (`Authorization: Bearer cpm_...`) created from a GitHub-backed registry account, the first authenticated publish of a name claims ownership, and only its maintainers can publish later versions. Adds `GET /me` and `GET /me/packages`, JSend 401/403 responses, and the `publishToken` security scheme in the OpenAPI document. Reads (`GET /packages`, tarballs, bundles, `POST /resolve`, `GET /install`) stay public. ([22a5602](https://github.com/ChungIndustries/chung-industries/commit/22a5602))

### ❤️ Thank You

- Christian Mattsson
- Claude Fable 5

## 0.0.3 (2026-08-26)

### 🩹 Fixes

- The OpenAPI spec now reports the released registry version instead of `0.0.0-development`, both at `GET /openapi.json` and in the published spec on Scalar. ([f5bb59d](https://github.com/ChungIndustries/chung-industries/commit/f5bb59d))
- The registry is now served at its canonical domain, https://registry.cpm.chungindustries.com, declared as a Workers custom domain in `wrangler.toml` and created automatically on deploy. ([a290db5](https://github.com/ChungIndustries/chung-industries/commit/a290db5))

### ❤️ Thank You

- Christian Mattsson
- Claude Fable 5

## 0.0.2 (2026-08-25)

### 🚀 Features

- Derive a client-facing bundle from every published tarball and serve it at `GET /packages/:name/:version/dist/bundle`. The bundle is a length-prefixed JSON manifest plus the raw file bytes, compressed on the wire only, so the in-game cpm client never gunzips or untars in Lua. `dist` is now nested per artifact kind: `dist.tarball = { url, shasum, integrity }` and `dist.bundle = { url, sha256, size }`; publishes are now validated as real gzipped tars containing only regular files with safe relative paths, at most 512 KiB extracted; link and device entries are rejected rather than dropped. ([7174e58](https://github.com/ChungIndustries/chung-industries/commit/7174e58))
- Add `GET /install`, serving the cpm bootstrap installer as plain Lua straight from the latest published `cpm` package, so a fresh computer is set up with `wget run https://registry.cpm.chungindustries.com/install`. ([7174e58](https://github.com/ChungIndustries/chung-industries/commit/7174e58))
- Adopt `cpm.json` as the package manifest: every published tarball must carry one at its root ({ name, version, author?, dependencies? }), it is the metadata source of truth and replaces the multipart `meta` field, so a publish is just the tarball upload. ([5b691a0](https://github.com/ChungIndustries/chung-industries/commit/5b691a0))
- Reject dots in package names: Lua's require maps dots to directory separators, so a dotted name would install where require never looks. Dots stay reserved until namespaced installs are designed deliberately. ([11a7813](https://github.com/ChungIndustries/chung-industries/commit/11a7813))
- Add `POST /resolve`, which pins one version per package for a set of root dependencies (semver ranges, exact versions, or dist-tags) and returns them dependencies-first. Resolution runs on the registry with the canonical `semver` package so the cpm client needs no semver logic. ([7174e58](https://github.com/ChungIndustries/chung-industries/commit/7174e58))
- The `cpm.json` manifest accepts an optional `startup` field: the path of a Lua file inside the package that the client runs at computer startup. A publish whose declared startup file is missing from the tarball is rejected. ([942d37c](https://github.com/ChungIndustries/chung-industries/commit/942d37c))
- Cap published tarballs at 5 MiB. Publishing a larger tarball now returns 413 and nothing is written to the index or the bucket, keeping the currently unauthenticated publish endpoint from being used to run up storage. ([eaa46a6](https://github.com/ChungIndustries/chung-industries/commit/eaa46a6))

### ❤️ Thank You

- Christian Mattsson
- Claude Fable 5
- Claude Opus 5

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