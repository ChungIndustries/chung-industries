---
cpm-registry: minor
---

Package owners can now manage who may publish: `GET /packages/{name}/maintainers` lists a package's maintainers (owner first, public), and `PUT` / `DELETE /packages/{name}/maintainers/{handle}` add or remove one (owner only, with a browser session or a `manage`-scoped token). Accounts are addressed by handle, seeded from the GitHub login at signup and immutable afterwards; accounts created before this release get theirs from a one-off backfill.
