---
cpm-registry: minor
---

Derive a client-facing bundle from every published tarball and serve it at `GET /packages/:name/:version/dist/bundle`. The bundle is a length-prefixed JSON manifest plus the raw file bytes, compressed on the wire only, so the in-game cpm client never gunzips or untars in Lua. `dist` is now nested per artifact kind: `dist.tarball = { url, shasum, integrity }` and `dist.bundle = { url, sha256, size }`; publishes are now validated as real gzipped tars with safe relative paths and at most 512 KiB extracted.
