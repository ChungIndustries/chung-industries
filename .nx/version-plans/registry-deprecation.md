---
cpm-registry: minor
---

Maintainers can now deprecate a version. A deprecated version still installs and downloads as before; the registry only attaches a warning message to it.

To deprecate one version, send `PUT /packages/{name}/{version}/deprecation` with `{ "message": "..." }`. To undo it, send `DELETE` to the same path. To deprecate or undeprecate every version of a package at once, use `PUT` or `DELETE /packages/{name}/deprecation`. Any maintainer can do this with a publish token or a website sign-in.

The message is returned as a `deprecated` field on the version wherever versions appear: the package document, the version endpoint, and the result of `POST /resolve`. Search results include the message of the package's `latest` version. Each deprecation change is recorded in the audit log.
