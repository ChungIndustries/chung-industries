/**
 * Throwaway config for `@better-auth/cli generate`, never imported by the
 * Worker. The CLI runs in Node and cannot reach a D1 binding, so schema SQL is
 * generated against an in-memory SQLite database instead; D1 is SQLite, so the
 * emitted DDL is valid as a committed `migrations/` file. The plugin set and
 * the user's additional fields here MUST mirror `src/components/auth/instance.ts`,
 * or the generated tables will drift from what the Worker expects at runtime.
 *
 * Usage (pin the CLI to the better-auth version in package.json, or the
 * generated schema drifts from what the runtime expects; see 0006_auth_issuer.sql):
 *   pnpm dlx auth@1.7.2 generate --config auth-schema.config.ts --output <file> -y
 * Diff the output against the applied migrations and commit the delta as a new
 * numbered migration; already-applied migration files never change.
 */
import { DatabaseSync } from "node:sqlite";

import { apiKey } from "@better-auth/api-key";
import { betterAuth } from "better-auth";

import { userAdditionalFields } from "./src/components/auth/handle";

export const auth = betterAuth({
  database: new DatabaseSync(":memory:"),
  user: { additionalFields: userAdditionalFields },
  socialProviders: {
    github: { clientId: "schema-gen-only", clientSecret: "schema-gen-only" },
  },
  plugins: [apiKey()],
});
