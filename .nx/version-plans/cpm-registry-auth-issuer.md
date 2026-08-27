---
cpm-registry: patch
---

Fixes GitHub sign-in failing with `internal_server_error`: better-auth 1.7 expects an `account.issuer` column that the 1.6-generated schema lacked. Adds the missing column and unique index as an additive migration, and pins `better-auth` and `@better-auth/api-key` to exact versions so the runtime and committed schema can no longer drift apart.
