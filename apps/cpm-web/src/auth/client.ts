import { apiKeyClient } from "@better-auth/api-key/client";
import { createAuthClient } from "better-auth/react";

/**
 * Better Auth client for browser-side mutations (sign-in, sign-out, token
 * create/revoke). The auth server is same-origin behind the `/auth` proxy
 * (routes/auth.$.ts), so per the Better Auth client docs only `basePath` is
 * set and the origin is resolved from the page; the session cookie stays
 * first-party. Only ever called in the browser. Pinned to the registry's
 * Better Auth version; keep the two in lockstep when upgrading.
 */
export const authClient = createAuthClient({
  basePath: "/auth",
  plugins: [apiKeyClient()],
});
