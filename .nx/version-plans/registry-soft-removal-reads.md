---
cpm-registry: minor
---

Soft-removed packages (`packages.deleted_at`) are now honoured by every read: they disappear from `GET /packages`, `GET /search`, and `GET /me/packages`, `GET /packages/{name}` and its version endpoint respond 404, `POST /resolve` fails with 404 when a root or transitive dependency has been removed, and `POST /packages` refuses the retired name with 403. Already-published tarballs and bundles stay downloadable by exact version, since published versions are immutable and never deleted from storage.
