---
cpm-registry: minor
---

Unpublished packages (`packages.unpublished_at`, renamed from `deleted_at`) are now honoured by every read, matching npm's `unpublish`: they disappear from `GET /packages`, `GET /search`, and `GET /me/packages`, `GET /packages/{name}` and its version endpoint respond 404, `POST /resolve` fails with 404 when a root or transitive dependency has been unpublished, `POST /packages` refuses the retired name with 403, and tarball and bundle downloads respond 404. Nothing is deleted from storage, so an unpublished package can be recovered; deprecation remains the path that keeps a package installable.
