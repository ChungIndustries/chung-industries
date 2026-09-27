/**
 * The authenticated caller as the rest of the registry sees it, deliberately
 * free of any Better Auth import: authentication resolves a credential to an
 * `Actor`, and everything downstream (service, stores) only ever reasons about
 * this shape. See docs/cpm-registry-auth-design.md, section 3.
 */
export const SCOPES = ["publish", "manage", "admin"] as const;
export type Scope = (typeof SCOPES)[number];

/** The publish token a token actor authenticated with, as shown on the account page. */
export interface ActorToken {
  name: string | null;
  /** ISO 8601 UTC, or null for a token without an expiry. */
  expiresAt: string | null;
}

export interface Actor {
  /** Better Auth `user.id`; what `package_maintainers.user_id` references. */
  userId: string;
  /** The user's display name (seeded from GitHub at sign-up). */
  name: string;
  scopes: readonly Scope[];
  via: "token" | "session";
  /** Present only for token actors. */
  token?: ActorToken;
}

/** Hono type parameter for routes that may carry an authenticated actor. */
export type AppEnv = { Bindings: Env; Variables: { actor: Actor } };
