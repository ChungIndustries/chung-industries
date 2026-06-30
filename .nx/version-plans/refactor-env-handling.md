---
cpm-registry: patch
---

Unify environment handling: validate env through a single zod schema in `src/env.ts`, load the standard `.env` cascade (`.env`, `.env.<mode>`, `.env.local`) via dotenv-flow, and drop the `dotenv-extended` / `dotenv-parse-variables` libraries plus the `.env.schema` / `.env.defaults` sidecar files. The `HOSTNAME` variable is renamed to `HOST`.
