---
cpm-registry: minor
---

Maintainers can deprecate a version, as in npm: `PUT /packages/{name}/{version}/deprecation` attaches a message to one version and `DELETE` clears it, while `PUT` and `DELETE /packages/{name}/deprecation` do the same for every version at once. Deprecation changes nothing about what is served, it only warns: the message appears as `deprecated` on the version in the package document, the version endpoint, and `POST /resolve`, and a search summary carries its `latest` version's message. Every change writes an `audit_events` row. `deprecated_message` moves from `packages` to `versions` in migration 0011.
