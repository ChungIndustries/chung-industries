/**
 * Throwaway config for `@better-auth/cli generate`, never imported by the
 * Worker. The CLI runs in Node and cannot reach a D1 binding, so schema SQL is
 * generated against an in-memory SQLite database instead; D1 is SQLite, so the
 * emitted DDL is valid as a committed `migrations/` file. The plugin set here
 * MUST mirror `src/auth.ts`, or the generated tables will drift from what the
 * Worker expects at runtime.
 *
 * Usage: pnpm dlx auth generate --config auth-schema.config.ts --output migrations/0003_auth.sql -y
 */
import { DatabaseSync } from "node:sqlite";

import { apiKey } from "@better-auth/api-key";
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  database: new DatabaseSync(":memory:"),
  socialProviders: {
    github: { clientId: "schema-gen-only", clientSecret: "schema-gen-only" },
  },
  plugins: [apiKey()],
});
