---
cpm-registry: minor
---

Publishing now requires an account: `POST /packages` takes a publish-scoped token (`Authorization: Bearer cpm_...`) created from a GitHub-backed registry account, the first authenticated publish of a name claims ownership, and only its maintainers can publish later versions. Adds `GET /me` and `GET /me/packages`, JSend 401/403 responses, and the `publishToken` security scheme in the OpenAPI document. Reads (`GET /packages`, tarballs, bundles, `POST /resolve`, `GET /install`) stay public.
