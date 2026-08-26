import { apiKey } from "@better-auth/api-key";
// Not `better-auth/minimal`: the native D1 binding support rides on Kysely,
// which minimal tree-shakes away (verified: minimal throws BetterAuthError
// "Direct database connection requires Kysely" at runtime). Full entry costs
// ~97 KiB gzip more, still well under the Worker size limit.
import { betterAuth } from "better-auth";

/**
 * Auth secrets are set with `wrangler secret put` (and `.dev.vars` locally), so
 * they are not part of the generated `Env` until declared there; this local
 * extension bridges the gap for the phase-0 spike.
 */
export interface AuthEnv extends Env {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
}

/**
 * Built per request: Cloudflare bindings (the D1 `DB`) only exist inside a
 * request context, so the auth instance cannot live at module scope. Better
 * Auth detects the D1 binding natively (>= 1.5) and uses `batch()` for
 * atomicity, matching how `D1RegistryStore` already writes.
 */
export function authFor(env: AuthEnv) {
  return betterAuth({
    database: env.DB,
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/auth",
    secret: env.BETTER_AUTH_SECRET,
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      },
    },
    plugins: [apiKey()],
  });
}
