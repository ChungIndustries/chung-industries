---
cpm-registry: minor
---

Re-platform the registry onto Cloudflare Workers (Hono + `@hono/zod-openapi`), storing package metadata in D1 and tarball bytes in R2. The HTTP API, JSend envelopes, and integrity/immutability guarantees are unchanged; the service now runs serverless with no local disk or long-running server.
