---
cpm-registry: minor
---

Soft-removed packages (`packages.deleted_at`) are now honoured by every read: they disappear from `GET /packages`, `GET /search`, and `GET /me/packages`, `GET /packages/{name}` and its version endpoint respond 404, `POST /resolve` fails with 404 when a root or transitive dependency has been removed, `POST /packages` refuses the retired name with 403, and tarball and bundle downloads respond 404, matching npm's unpublish. Nothing is deleted from storage, so a removed package can be recovered; deprecation remains the path that keeps a package installable.
