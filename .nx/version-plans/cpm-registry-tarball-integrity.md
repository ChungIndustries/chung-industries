---
cpm-registry: minor
---

Record tarball integrity on publish: each version's `dist` now carries `shasum` (SHA-1) and `integrity` (sha512 SRI), so clients can verify downloaded tarballs.
