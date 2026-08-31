import { apiKeyClient } from "@better-auth/api-key/client";
import { createAuthClient } from "better-auth/react";

import { SITE_ORIGIN } from "@/site";

/**
 * Better Auth client for browser-side mutations (sign-in, sign-out, token
 * mint/revoke). It talks to the same-origin `/auth` proxy (routes/auth.$.ts),
 * so the session cookie stays first-party. Only ever called in the browser;
 * the SSR fallback origin merely satisfies module evaluation. Pinned to the
 * registry's Better Auth version; keep the two in lockstep when upgrading.
 */
export const authClient = createAuthClient({
  baseURL: `${typeof window === "undefined" ? SITE_ORIGIN : window.location.origin}/auth`,
  plugins: [apiKeyClient()],
});
