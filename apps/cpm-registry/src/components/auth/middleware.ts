import type { MiddlewareHandler } from "hono";

import {
  SCOPES,
  type Actor,
  type ActorToken,
  type AppEnv,
  type Scope,
} from "@/components/auth/actor";
import { authFor } from "@/components/auth/instance";
import { isAdminRole } from "@/components/auth/role";
import { ForbiddenError, UnauthorizedError } from "@/errors";

/** A resolved identity, before `resolveActor` stamps how it was authenticated. */
export interface AuthenticatedUser {
  userId: string;
  name: string;
}

/**
 * What each credential type may hold (docs/cpm-registry-auth-design.md,
 * section 10.3). A publish token never carries more than `publish`, whatever
 * its stored permissions say: `manage` and `admin` are session-only, so a
 * leaked CI secret can publish a bad version but never take a package away.
 */
const TOKEN_SCOPES: readonly Scope[] = ["publish"];
const SESSION_SCOPES: readonly Scope[] = [...TOKEN_SCOPES, "manage"];
const ADMIN_SESSION_SCOPES: readonly Scope[] = [...SESSION_SCOPES, "admin"];

/**
 * The two credential lookups the registry needs from the auth system, as an
 * interface so `resolveActor` can be tested with fakes. `betterAuthGateway` is
 * the only production implementation and, together with `instance.ts`, the
 * only code that knows Better Auth exists.
 */
export interface AuthGateway {
  /** Resolves a publish token to its owner, scopes, and the token's own details, or null if invalid. */
  verifyToken(
    token: string,
  ): Promise<(AuthenticatedUser & { scopes: Scope[]; token: ActorToken }) | null>;
  /** Resolves a session cookie to its user and whether they hold the admin role, or null if not signed in. */
  sessionUser(headers: Headers): Promise<(AuthenticatedUser & { admin: boolean }) | null>;
}

export function betterAuthGateway(env: Env): AuthGateway {
  const auth = authFor(env);
  return {
    async verifyToken(token) {
      const result = await auth.api.verifyApiKey({ body: { key: token } });
      if (!result.valid || !result.key) return null;
      // The API key plugin knows only its owner's id. The name comes from Better
      // Auth's own `user` table (vendor-owned, read-only for us); a key whose
      // user is gone does not authenticate.
      const user = await env.DB.prepare('select "name" from "user" where "id" = ?1')
        .bind(result.key.referenceId)
        .first<{ name: string }>();
      if (!user) return null;
      const expiresAt = result.key.expiresAt;
      return {
        userId: result.key.referenceId,
        name: user.name,
        scopes: parseScopes(result.key.permissions),
        token: {
          name: result.key.name ?? null,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        },
      };
    },
    async sessionUser(headers) {
      const session = await auth.api.getSession({ headers });
      if (!session) return null;
      return {
        userId: session.user.id,
        name: session.user.name,
        admin: isAdminRole(session.user.role),
      };
    },
  };
}

/** Key permissions `{ registry: [...] }` narrowed to the scopes we know. */
function parseScopes(permissions: unknown): Scope[] {
  const parsed = typeof permissions === "string" ? JSON.parse(permissions) : permissions;
  const granted = (parsed as { registry?: unknown } | null)?.registry;
  return Array.isArray(granted) ? SCOPES.filter((scope) => granted.includes(scope)) : [];
}

/**
 * Resolves the request's credential to an {@link Actor}: a bearer publish
 * token when the Authorization header is present (a bad one is a hard 401,
 * never a silent fall-through to the cookie), otherwise the browser session.
 * Returns null for anonymous requests; routes decide whether that is allowed.
 * This is where the credential type caps the scopes (see {@link TOKEN_SCOPES}).
 */
export async function resolveActor(headers: Headers, gateway: AuthGateway): Promise<Actor | null> {
  const header = headers.get("authorization");
  if (header !== null) {
    const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
    if (!match) {
      throw new UnauthorizedError("Malformed Authorization header, expected: Bearer <token>");
    }
    const verified = await gateway.verifyToken(match[1] as string);
    if (!verified) throw new UnauthorizedError("Invalid or expired token");
    const scopes = verified.scopes.filter((scope) => TOKEN_SCOPES.includes(scope));
    return {
      userId: verified.userId,
      name: verified.name,
      scopes,
      via: "token",
      token: verified.token,
    };
  }
  const user = await gateway.sessionUser(headers);
  if (user) {
    // A signed-in human holds their full authority; only tokens are narrowed.
    const scopes = user.admin ? ADMIN_SESSION_SCOPES : SESSION_SCOPES;
    return { userId: user.userId, name: user.name, scopes, via: "session" };
  }
  return null;
}

/**
 * Route middleware: require an authenticated actor (any credential, no
 * particular scope) and expose it as `c.get("actor")`. Thrown errors are
 * mapped to JSend 401 by the `onError` handler in `index.ts`.
 */
export function requireActor(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const actor = await resolveActor(c.req.raw.headers, betterAuthGateway(c.env));
    if (!actor) throw new UnauthorizedError("Authentication required");
    c.set("actor", actor);
    await next();
  };
}

/**
 * Route middleware: {@link requireActor}, plus the actor must hold the given
 * scope (403 otherwise). A token refused a scope no token can hold is told to
 * sign in rather than sent looking for a scope it cannot be granted.
 */
export function requireActorScope(scope: Scope): MiddlewareHandler<AppEnv> {
  const authenticated = requireActor();
  return (c, next) =>
    authenticated(c, () => {
      const actor = c.get("actor");
      if (!actor.scopes.includes(scope)) {
        throw new ForbiddenError(
          actor.via === "token" && !TOKEN_SCOPES.includes(scope)
            ? "Publish tokens cannot do this, sign in on the website instead"
            : `Missing the ${scope} scope`,
        );
      }
      return next();
    });
}
