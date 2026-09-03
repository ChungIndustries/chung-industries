import { apiKey } from "@better-auth/api-key";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";

import { handleTaken, pickHandle, userAdditionalFields } from "@/components/auth/handle";
import { parseEnv } from "@/env";

const NINETY_DAYS_S = 90 * 24 * 60 * 60;

/**
 * Built per request: Cloudflare bindings (the D1 `DB`) only exist inside a
 * request context, so the auth instance cannot live at module scope. Better
 * Auth detects the D1 binding natively (>= 1.5) and uses `batch()` for
 * atomicity, matching how `D1RegistryStore` already writes.
 *
 * Not `better-auth/minimal`: the native D1 binding support rides on Kysely,
 * which minimal tree-shakes away (verified: minimal throws BetterAuthError
 * "Direct database connection requires Kysely" at runtime). Full entry costs
 * ~97 KiB gzip more, still well under the Worker size limit.
 */
export function authFor(env: Env) {
  const secrets = parseEnv(env);
  return betterAuth({
    database: env.DB,
    baseURL: secrets.BETTER_AUTH_URL,
    basePath: "/auth",
    secret: secrets.BETTER_AUTH_SECRET,
    // Mirrored in auth-schema.config.ts and migrations/0008_handles.sql.
    user: { additionalFields: userAdditionalFields },
    databaseHooks: {
      user: {
        create: {
          // The login `mapProfileToUser` copied in may already be somebody's
          // handle (a GitHub login renamed away and re-registered); settle it
          // here, where the database is reachable, before the row is written.
          before: async (user) => {
            if (typeof user.handle !== "string" || user.handle === "") return;
            const handle = await pickHandle(user.handle, (h) => handleTaken(env.DB, h));
            return { data: { handle } };
          },
        },
        update: {
          // Handles are immutable (design decision 4). Sign-ins never carry one
          // (`overrideUserInfoOnSignIn` is off), so the only update that can is
          // a client calling `/auth/update-user` to pick its own address.
          before: async (data) => {
            if ("handle" in data) {
              throw new APIError("BAD_REQUEST", { message: "Handles cannot be changed" });
            }
          },
        },
      },
    },
    socialProviders: {
      github: {
        clientId: secrets.GITHUB_CLIENT_ID,
        clientSecret: secrets.GITHUB_CLIENT_SECRET,
        // Seeds the handle at signup; existing accounts are never re-mapped.
        mapProfileToUser: (profile) => ({ handle: profile.login }),
      },
    },
    plugins: [
      apiKey({
        defaultPrefix: "cpm_",
        // Tokens read like an inventory on the account page: one per machine,
        // named after it (docs/cpm-registry-auth-design.md, section 10.4).
        requireName: true,
        // The type docs say milliseconds, but the implementation feeds this to
        // getDate(..., "sec"): it is SECONDS (verified against the 1.6.25
        // source; re-check on upgrade). The plugin's client-facing cap,
        // maxExpiresIn, is in DAYS and already defaults to 365.
        keyExpiration: { defaultExpiresIn: NINETY_DAYS_S },
        // Freshly minted tokens are publish-only; `manage` must be granted
        // deliberately (docs/cpm-registry-auth-design.md, section 10.3).
        permissions: { defaultPermissions: { registry: ["publish"] } },
      }),
    ],
  });
}
