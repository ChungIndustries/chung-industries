/**
 * The authenticated caller as the rest of the registry sees it, deliberately
 * free of any Better Auth import: authentication resolves a credential to an
 * `Actor`, and everything downstream (service, stores) only ever reasons about
 * this shape. See docs/cpm-registry-auth-design.md, section 3.
 */
export const SCOPES = ["publish", "manage", "admin"] as const;
export type Scope = (typeof SCOPES)[number];

export interface Actor {
  /** Better Auth `user.id`; what `package_maintainers.user_id` references. */
  userId: string;
  scopes: readonly Scope[];
  via: "token" | "session";
}

/** Hono type parameter for routes that may carry an authenticated actor. */
export type AppEnv = { Bindings: Env; Variables: { actor: Actor } };
