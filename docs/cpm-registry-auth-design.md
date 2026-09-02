# CPM Registry: authentication and package ownership

Status: phases 0-2 implemented (accounts, tokens, ownership enforcement); account/token UI shipped
in `apps/cpm-web` 2026-09-01 (see section 12, decision 2); phases 3+ pending
Scope: `apps/cpm-registry`, the publish tooling that authenticates to it (CI and author terminals today, possibly an in-game client later), and the minimal browser surface accounts need
Date: 2026-08-27

## 1. Problem and constraints

`POST /packages` is currently open to anyone. That was a deliberate pre-launch choice; this document
describes what replaces it. The registry needs real per-user accounts, npm style: a human signs up in
a browser, a machine publishes with a token that belongs to that human, and every publish is checked
against who owns the package name.

Fixed constraints:

- **No Supabase**, in any form. Ruled out for this work regardless of what else lives in the monorepo.
- **No shared secret, no single admin token.** Real accounts or nothing.
- The registry is a **Cloudflare Worker** (Hono + `@hono/zod-openapi`), metadata in **D1** (`DB`),
  tarballs in **R2** (`BUCKET`). No origin server to fall back on.
- Publishers run on **real machines, not in game**: the shipped `cpm` client
  ([docs/cpm-client-design.md](cpm-client-design.md), section 8) deliberately has no `publish`
  command. Today's actual publishers are the release workflow (CI publishes the `cpm` package itself
  via `apps/cpm-cli/scripts/publish.mjs`) and authors publishing from a normal terminal. In-game
  publishing from CC:Tweaked (Lua, no browser, no keychain, world-readable filesystem) remains a
  possible future surface and is designed for in section 10, but it is no longer the primary one.
- Data will be **wiped** when auth ships. No migration path for existing accounts or packages is needed.
- Repo conventions apply: zod-validated env, generated `Env` type, JSend envelopes, domain errors in
  `src/errors.ts`, routes colocated with handlers, Vitest under `tests/`, no trailing periods in
  API-served error messages, `openapi.yaml` regenerated and committed (`pnpm --filter cpm-registry gen-docs`).

## 2. Decisions at a glance

| #   | Decision                                                                                                                                                                    | Short reason                                                                                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | One identity system serves both surfaces, with two credential types                                                                                                         | The authorization check is identical for a browser session and a publish token; only credential resolution differs                                                       |
| 2   | **Better Auth** for authentication (sessions, GitHub OAuth, publish tokens)                                                                                                 | Runs on workerd, native D1 support since 1.5, GitHub OAuth + API keys + device flow are exactly the roadmap                                                              |
| 3   | **Authorization stays hand-rolled** in the registry's own tables                                                                                                            | Package ownership is domain logic. No auth library models "who may publish `turtle-utils`"                                                                               |
| 4   | Auth state lives in the **same D1 database** as the registry                                                                                                                | One binding, and the ownership check can share a transaction with the version insert                                                                                     |
| 5   | Publish credential is a **long-lived bearer token**, hashed at rest, publish-scoped by default                                                                              | Mirrors npm granular tokens; works identically for CI, a terminal, and any future in-game client                                                                         |
| 6   | **First publish wins** the name, recorded in a `package_maintainers` ACL with exactly one owner                                                                             | Simplest rule that is also npm's rule; multi-maintainer support falls out of the same table                                                                              |
| 7   | Token onboarding is **paste-a-token**; the **RFC 8628 device flow** is parked unless in-game publishing ships                                                               | The shipped client has no publish command (updated 2026-08-27), so today's consumers are CI secrets and real terminals, where pasting is the normal thing                |
| 8   | The account/token UI is **deferred**; any interim surface is a minimal stopgap, and the real UI ships later as **its own app** (not `apps/web`, not folded into the Worker) | Decided 2026-08-27. Building UI is explicitly not part of this phase; the API is designed so a browser is only strictly needed for the GitHub redirect and token display |

## 3. The two surfaces

npm separates these and so should we:

**Human / browser.** Sign up, sign in, see your packages, mint and revoke tokens, add a maintainer,
transfer or deprecate a package. Credential: a session cookie. Interactive, rare, tolerant of
redirects and JavaScript.

**Machine.** A publish is one multipart POST (the tarball is the whole request; metadata comes from
the `cpm.json` at its root). Credential: a bearer token in an `Authorization` header. Non-interactive,
must work with one HTTP call, no redirects, no cookie jar. Today this surface has two concrete
callers: the release workflow publishing `cpm` itself (token from a GitHub Actions secret) and an
author at a terminal. A future in-game CC:Tweaked publisher would be a third caller of the same
endpoint with the same header.

**Should one system serve both?** Yes, with a hard split in the middle:

```
browser session ─┐
                 ├─> resolve to an Actor { userId, scopes } ─> authorization (our code, our tables)
publish token   ─┘
```

Authentication (proving which user) differs per surface and is worth delegating. Authorization
(may this user publish this name) is identical for both, is where the actual security of the
registry lives, and is ours. Every route makes one call to resolve an `Actor` and then asks the
same authorization question. Two separate identity systems would mean two user tables and a
join problem the first time someone wants to see "my packages" in the browser.

## 4. Options evaluated

### 4.1 Better Auth (recommended)

What was verified against current docs (Better Auth is at 1.6.x as of this writing; pin and re-verify
at implementation time, this library moves fast):

- **Runs on workerd.** Yes. Cloudflare Workers is a supported target, and 1.5 shipped fixes for
  immutable headers on Workers.
- **D1 adapter.** As of 1.5, D1 is a **first-class database option**: pass the binding directly,
  `betterAuth({ database: env.DB })`, no Drizzle and no custom adapter. It drives D1's native API for
  queries, batching and introspection. Note the documented caveat: **D1 has no interactive
  transactions**, so Better Auth uses `batch()` for atomicity. That matches what
  `D1RegistryStore.addVersion` already does.
- **Per-request instantiation is mandatory.** Bindings only exist inside a request, so the auth
  instance must be built from `c.env` per request, not at module scope. Every credible Workers guide
  says the same thing. Cheap (object construction), but it shapes the code.
- **Hono integration** is a one-liner: `app.on(["GET", "POST"], "/auth/*", (c) => auth(c.env).handler(c.req.raw))`,
  plus an optional middleware that puts the session on the context.
- **Bundle size.** 1.5 added a `better-auth/minimal` entry point that tree-shakes unused features
  (it drops Kysely, which is only needed for direct database connections). Measured in phase 0:
  the full entry point lands at 449 KiB gzip including the api-key plugin, well under Worker
  limits, and `minimal` turns out to be incompatible with the native D1 binding anyway (see the
  phase 0 results in section 11).
- **API key plugin** (now its own package, `@better-auth/api-key`): creates keys, returns the raw key
  once, stores it hashed, supports prefixes, `expiresIn`, per-key `permissions` as
  `Record<string, string[]>`, rate limiting, metadata, and remaining/refill counters. `verifyApiKey`
  takes the key plus the permissions to require. This is a very close fit for npm-style publish
  tokens, including the scope model.
- **Bearer plugin** is a different thing: it lets a _session token_ be sent as a bearer header instead
  of a cookie. The docs explicitly warn to use it only where cookies are impossible. We do not need it
  if publish tokens are API keys. Do not enable it just because the CLI sends `Authorization: Bearer`.
- **Device authorization plugin** implements RFC 8628: `POST /device/code` returns `device_code`,
  `user_code` (8 chars from a confusable-free alphabet), `verification_uri` and a poll `interval`;
  the client polls `POST /device/token` until the user approves at `GET /device?user_code=...`.
  Defaults: 30 minute expiry, 5 second minimum poll interval. This is the textbook answer for a device
  with no browser, which is exactly a Minecraft computer.

Where it earns its complexity: the GitHub OAuth dance (state, PKCE, code exchange, account linking),
session cookie handling and CSRF, and a correct RFC 8628 implementation. Those are the parts that are
tedious to get right and unpleasant to get wrong.

Where it does not: it has no opinion whatsoever about package ownership, which is the part that
actually protects the registry.

Costs, stated honestly:

- Roughly 6 to 10 extra tables in the registry database whose shape we do not control.
- Schema generation is awkward on native D1. `@better-auth/cli migrate` cannot reach a D1 binding from
  Node. The workable path is `@better-auth/cli generate` against a throwaway local SQLite config that
  mirrors the real one, then commit the emitted SQL as a numbered file under `migrations/`. This needs
  a spike; see open questions.
- Its routes are mounted as an opaque handler, so they are invisible to `@hono/zod-openapi` and will
  not appear in the generated `openapi.yaml`. Mitigated by section 9.
- Version churn. 1.6.x is active development. Pin exactly and read changelogs at upgrade time.

### 4.2 Hand-rolled accounts and tokens in D1

Perfectly viable, and genuinely the smaller thing today: a `users` table keyed on GitHub id, a
`tokens` table of SHA-256 hashes with a scope column and an expiry, plus about 150 lines for the
GitHub OAuth callback. Web Crypto gives us hashing on Workers with no dependency at all.

The honest comparison is not "hand-rolled vs library" in the abstract, it is **which parts**:

- Bearer token minting, hashing, lookup, scope check, expiry, revocation: **trivial to hand-roll**.
  Perhaps 120 lines and a table. A library adds little here beyond convention.
- OAuth authorization code flow with state and PKCE, session cookies with rotation and CSRF, device
  authorization grant with polling and `slow_down` semantics: **not trivial**, and the failure modes
  are silent.

If the registry were publish-token-only with tokens minted by hand, a small D1 table would clearly win.
The moment "sign in with GitHub in a browser" is a requirement, and it is, the balance tips. The
recommendation therefore takes the library for the hard half and keeps the easy half in our own code
regardless (the ownership tables), which is where the leverage is.

Keep this option alive as the fallback: if Better Auth's bundle size or its D1 migration story proves
painful in the spike, the schema in section 7 barely changes. Only the `user`, `session`, `account`
and `apikey` tables get replaced by three hand-written ones, and `resolveActor` changes shape.

### 4.3 Auth.js / `@auth/core`

Framework-agnostic, has a D1 adapter, runs on Workers, integrates with Hono via `@hono/auth-js`.
It solves OAuth and sessions and stops there: no API keys, no device flow, so the entire machine
surface stays hand-rolled anyway. Its center of gravity is Next.js, and its Hono story is thinner
than Better Auth's. It would be a reasonable pick if the browser surface were the only surface. It
is not, so it is strictly dominated here.

### 4.4 Hosted identity providers (Clerk, WorkOS, Auth0)

The network-hop objection is weaker than it first looks: these issue JWTs, and a Worker can verify
them locally against a JWKS cached in KV, so the steady-state cost is a signature check, not a round
trip. The real objections are different:

- They authenticate; they still do not own package ownership. We write section 8 either way.
- Machine-to-machine tokens are a paid tier almost everywhere, and they are the _main_ credential here.
- Lock-in on the one part of the system whose data model is entirely ours, for a hobby-scale Minecraft
  package registry, on a stack with no per-request revenue.
- An external dependency that can be down while D1 and R2 are up.

Rejected. Reasonable for a company with a compliance department; wrong shape for this.

### 4.5 Cloudflare Access / Zero Trust

Wrong tool, not a close call. Access is a perimeter for applications used by a known set of people,
with an admin-provisioned identity list. Service tokens are admin-issued client credentials with no
per-user identity attached, which puts us right back at "a shared secret", the thing explicitly ruled
out. There is no self-service signup, no notion of "the user who owns this package", and the seat
model does not fit an open public registry. Rejected.

### 4.6 Workers-native primitives

There is no identity primitive in Workers. There are useful pieces we should use regardless of which
option above wins:

- **Web Crypto** (`crypto.subtle`) for token hashing. Already available; `nodejs_compat` is on.
- **KV** as an optional cache for token verification, to keep the hot publish path off D1.
  Premature at current volume; note it and move on.
- **WAF rate limiting rules**, or Better Auth's own rate limiter, on publish and token creation.
- `@cloudflare/workers-oauth-provider` exists but solves the inverse problem (making a Worker _be_ an
  OAuth provider, as MCP servers do). Not what we need.

### 4.7 Recommendation

**Better Auth, in the same Worker, on the same D1 database, with GitHub OAuth for humans and the API
key plugin for publish tokens. Ownership and authorization stay in registry-owned tables and
registry-owned code.**

Adopt behind a spike (section 11, phase 0) that answers two questions and nothing else: does the
Worker still bundle and deploy comfortably, and can the auth schema be produced as a committed SQL
migration. If either answer is bad, fall back to 4.2 and keep everything from section 7 onward.

## 5. Where auth state lives

**Same D1 database (`DB`), same migration lineage.** Reasons, in order of weight:

1. **The publish path can check authorization and write the version in one `batch()`**, which D1 runs
   as a single transaction. With a separate database that check becomes a read against another service
   and a time-of-check-to-time-of-use gap opens between "is a maintainer" and "insert version"
   (section 8.4 shows the query that closes it).
2. One binding, one migration command, one thing to back up, no cross-database joins to render
   "packages you maintain".
3. D1 limits are nowhere near binding at this scale.

Schema implications either way:

- **Same database (chosen).** Better Auth's tables land next to `packages` / `versions` / `dist_tags`.
  Keep them in their own migration files, never hand-edit them, and treat them as vendor-owned. Our
  tables reference `user(id)` with real foreign keys. `user.id` is a TEXT id generated by the library,
  so every ownership column is `TEXT`.
- **Separate database (rejected).** Ownership tables could not have a foreign key to `user`, so
  `user_id` becomes an unenforced string, deleting a user cannot cascade, and the authorization check
  becomes an extra round trip on every publish. The only thing it buys is the freedom to swap auth
  systems without touching the registry database, which the wipe already gives us for free.

## 6. Trust model

- Anything on a Minecraft computer is **readable by anyone who can reach that computer**, in game or by
  editing the world save. A publish token is therefore a credential that leaks by default. Everything
  in section 10 follows from accepting that rather than pretending otherwise.
- The Worker is trusted. D1 and R2 are trusted.
- Tarball contents are **not** trusted and are not made safer by auth. Auth answers "who published
  this", not "is this Lua safe to run". Out of scope, worth stating.
- Threats in scope: anonymous publishing, name hijacking, publishing to someone else's package,
  a leaked token being usable forever or for anything.
- Threats out of scope for v1: malicious package content, typosquatting by similar names, account
  takeover of the upstream GitHub account, 2FA.

## 7. Data model

Three migration files, additive, applied after the wipe. `0001_init.sql` and `0002_bundles.sql`
(the bundle columns added for the client, 2026-08) stay as they are.

### 7.1 `0003_auth.sql` (vendor-owned, generated)

Generated by `@better-auth/cli generate` and committed verbatim. Expected tables for the chosen plugin
set: `user`, `session`, `account`, `verification`, `apikey`, and later `deviceCode`. Do not hand-edit;
regenerate on upgrade and commit the diff as a new numbered migration.

### 7.2 `0004_ownership.sql` (ours)

```sql
-- Who may publish a package name. Exactly one row per package has role 'owner';
-- the partial unique index is what enforces that. Authorization is a single
-- indexed lookup on (package_name, user_id), cheap enough to fold into the
-- publish transaction (see the guarded INSERT in the service).
CREATE TABLE package_maintainers (
  package_name TEXT    NOT NULL,
  user_id      TEXT    NOT NULL,
  role         TEXT    NOT NULL CHECK (role IN ('owner', 'maintainer')),
  added_at     INTEGER NOT NULL,
  added_by     TEXT,
  PRIMARY KEY (package_name, user_id),
  FOREIGN KEY (package_name) REFERENCES packages (name) ON DELETE CASCADE,
  FOREIGN KEY (user_id)      REFERENCES user (id)       ON DELETE CASCADE
);

CREATE UNIQUE INDEX package_maintainers_single_owner
  ON package_maintainers (package_name) WHERE role = 'owner';

CREATE INDEX package_maintainers_by_user ON package_maintainers (user_id);

-- Names nobody may claim: the cpm/chung prefixes, anything shipped in the
-- default install, and names freed by a removal (kept as tombstones so a
-- removed package name can never be re-registered by someone else).
CREATE TABLE reserved_names (
  name       TEXT    NOT NULL PRIMARY KEY,
  reason     TEXT,
  created_at INTEGER NOT NULL
);

-- Append-only record of every state change that is not itself a version insert.
-- Cheap, and the first thing anyone will want when a package changes hands.
CREATE TABLE audit_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id TEXT,
  action        TEXT    NOT NULL, -- publish | transfer | maintainer.add | maintainer.remove |
                                  -- token.create | token.revoke | deprecate | remove
  package_name  TEXT,
  detail        TEXT,             -- JSON, action-specific
  created_at    INTEGER NOT NULL
);

CREATE INDEX audit_events_by_package ON audit_events (package_name, created_at);
```

### 7.3 `0005_provenance.sql` (ours)

```sql
-- `versions.author` and `packages.author` are free-text metadata the publisher
-- typed; `published_by` is the authenticated identity that actually did it.
-- Keeping both means the display name stays cosmetic and never load-bearing.
ALTER TABLE versions  ADD COLUMN published_by TEXT REFERENCES user (id);

-- Soft delete only. The row survives so the name stays claimed (see
-- reserved_names), and tarballs are never deleted from R2.
ALTER TABLE packages ADD COLUMN deprecated_message TEXT;
ALTER TABLE packages ADD COLUMN deleted_at         INTEGER;
```

Deliberately **not** added: any ownership column on `packages`. A single ACL table is one source of
truth, and the partial unique index makes "the owner" well defined without a second place to disagree.

## 8. Authorization model

This is the part that protects the registry. Authentication only says who is calling.

### 8.1 Who owns a name

**First publish wins.** Publishing a name that does not exist creates the package and inserts an
`owner` row for the publisher in the same transaction. There is no separate reservation step and no
claim queue.

Blocked before that: names in `reserved_names`, and names that fail the existing `nameParam` validation.
Seed `reserved_names` with `chung`, `registry`, and similar infrastructure names. `cpm` itself is NOT
reserved: it is a real published package (CI publishes it every cpm-cli release), so it gets claimed
by its owner account through the normal first-authenticated-publish path during the phase 2 cutover,
before anyone else can race for it (the wipe and the token flip happen in the same release).

### 8.2 Multiple maintainers

`package_maintainers` holds one `owner` and zero or more `maintainer` rows.

| Action                     | owner | maintainer |
| -------------------------- | ----- | ---------- |
| Publish a new version      | yes   | yes        |
| Set a dist-tag             | yes   | yes        |
| Deprecate                  | yes   | yes        |
| Add or remove a maintainer | yes   | no         |
| Transfer ownership         | yes   | no         |
| Remove the package         | yes   | no         |

Maintainers are added by user handle, and the target must already have an account. No email invites.

### 8.3 Transfer and removal

**Transfer** is two-step: the owner nominates a new owner, and the nominee accepts before anything
changes. One-step transfer lets anyone dump an unwanted package on a stranger's account. On accept,
in one transaction: the old owner's row becomes `maintainer`, the nominee's row becomes `owner`, and
an `audit_events` row is written. The partial unique index means a botched transfer fails loudly
rather than producing two owners.

**Removal is soft and never frees the name.** Set `packages.deleted_at`, insert into `reserved_names`
with the reason, leave `versions` and the R2 objects untouched. Published versions stay immutable; that
property is load-bearing for anyone who has already installed one. Removed packages disappear from
`GET /packages` and return 404 from `GET /packages/{name}`.

**Deprecation** is the soft alternative: `packages.deprecated_message` is returned in the package
document, the client prints it on install, and nothing else changes. This should be the common path.

### 8.4 How publish checks authorization

Two layers, mirroring the pattern the immutability check already uses (a friendly pre-check plus an
atomic backstop in the storage layer).

**Pre-flight, in `PackageService.publish`,** before any R2 write, so a rejected publish never leaves
orphan bytes and the caller gets a specific message:

1. `reserved_names` contains the name and the actor is not an admin, `403`.
2. The package exists, is not soft-deleted, and the actor has no `package_maintainers` row, `403`.
3. Everything else proceeds exactly as today.

**Atomic backstop, in `D1RegistryStore.addVersion`,** inside the existing `batch()`. The version
insert becomes conditional on maintainership:

```sql
INSERT INTO versions (package_name, version, author, dependencies, shasum, integrity,
                      tarball_key, published_by, created_at)
SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9
WHERE EXISTS (
  SELECT 1 FROM package_maintainers WHERE package_name = ?1 AND user_id = ?8
);
```

Preceded in the same batch by:

```sql
INSERT INTO packages (name, author, created_at) VALUES (?1, ?3, ?9) ON CONFLICT(name) DO NOTHING;
INSERT INTO package_maintainers (package_name, user_id, role, added_at)
  VALUES (?1, ?8, 'owner', ?9) ON CONFLICT(package_name, user_id) DO NOTHING;
```

The two failure modes stay distinguishable, which matters for the response code:

- The `INSERT ... SELECT` throws a primary key violation, the version already exists, `409` (unchanged).
- The `INSERT ... SELECT` affects **zero rows** (`meta.changes === 0`), the actor is not a maintainer,
  `403`.

First-publish-wins races resolve for free. Two publishers racing on a new name both attempt the owner
insert; the loser's is a no-op, so its guarded version insert matches nothing and it gets a `403`.
The same query also closes the window where a maintainer is removed between the pre-flight check and
the write.

`PackageService` takes the actor as an argument and never touches headers, so it stays unit-testable
against the in-memory store exactly as it is today.

## 9. API surface changes

### 9.1 Endpoints

Machine surface, JSend, part of `openapi.yaml`:

| Method   | Path                                    | Auth                             | Notes                                                                        |
| -------- | --------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------- |
| `POST`   | `/packages`                             | bearer, `publish` scope          | now `401` / `403`                                                            |
| `GET`    | `/me`                                   | bearer or session                | whoami: user handle, token scopes, expiry; also how CI smoke-tests its token |
| `GET`    | `/me/packages`                          | bearer or session                | packages the actor maintains                                                 |
| `PUT`    | `/packages/{name}/dist-tags/{tag}`      | bearer, `publish` scope          | maintainers only                                                             |
| `POST`   | `/packages/{name}/deprecate`            | bearer, `publish` scope          | maintainers only                                                             |
| `POST`   | `/packages/{name}/maintainers`          | session, or bearer with `manage` | owner only                                                                   |
| `DELETE` | `/packages/{name}/maintainers/{handle}` | session, or bearer with `manage` | owner only                                                                   |
| `POST`   | `/packages/{name}/transfer`             | session, or bearer with `manage` | owner nominates                                                              |
| `POST`   | `/packages/{name}/transfer/accept`      | session                          | nominee accepts                                                              |

Reads stay **public and unauthenticated**: `GET /packages`, `GET /packages/{name}`, the tarball and
bundle downloads, and also `POST /resolve` and `GET /install` (added by the client work, 2026-08).
`/resolve` deserves an explicit callout because it is a POST: auth must be attached per-route (or the
middleware scoped to specific paths), never as a blanket "all POSTs require a token" rule, or the
resolver and the `wget run .../install` bootstrap break for every anonymous computer. A package
registry nobody can read is not a registry.

Human surface, mounted as an opaque Better Auth handler under `/auth/*`: GitHub OAuth start and
callback, session, sign-out, API key create/list/revoke, and later the device endpoints.

**These two groups follow different response contracts, and that is a deliberate boundary.**
Better Auth returns its own JSON shapes and its own error format. Rather than fight it: everything
under `/auth/*` is documented as library-native and browser-only, and **anything the `cpm` client
touches gets a thin registry route in the JSend envelope**. If the CLI ever needs to mint a token
directly, that becomes a registry route that calls `auth.api.createApiKey` internally and returns
JSend, not a raw passthrough.

### 9.2 Errors

Two new classes in `src/errors.ts`, mapped by the existing `onError` to JSend `fail`:

```ts
export class UnauthorizedError extends RegistryError {
  constructor(message: string) {
    super(401, message);
  }
}

export class ForbiddenError extends RegistryError {
  constructor(message: string) {
    super(403, message);
  }
}
```

Semantics, kept strict because the CLI branches on them:

- **401**: no credential, malformed credential, unknown token, revoked token, expired token.
  Client action: log in again. Messages: `Authentication required`, `Invalid or expired token`.
- **403**: the credential is good but insufficient. Client action: do not retry.
  Messages: `Token is missing the publish scope`, `You are not a maintainer of "turtle-utils"`,
  `Package name is reserved`.

No trailing periods, per convention. Send `WWW-Authenticate: Bearer` alongside 401 (this requires a
small change to `onError`, which currently returns a body with no custom headers).

### 9.3 OpenAPI

`@hono/zod-openapi` exposes `openAPIRegistry`, so the security scheme is registered once in `index.ts`:

```ts
app.openAPIRegistry.registerComponent("securitySchemes", "publishToken", {
  type: "http",
  scheme: "bearer",
  description:
    "A cpm publish token, created from the registry website. Send as `Authorization: Bearer cpm_...`.",
});
```

and referenced per route:

```ts
createRoute({
  method: "post",
  path: "/packages",
  security: [{ publishToken: [] }],
  responses: {
    201: jsonSuccess(packageSchema, "Published"),
    400: jsonFail("Invalid request"),
    401: jsonFail("Authentication required"),
    403: jsonFail("Not a maintainer of this package"),
    409: jsonFail("Version already published"),
    500: serverError,
  },
});
```

Then `pnpm --filter cpm-registry gen-docs` and commit `openapi.yaml` in the same PR. CI fails on drift,
so this is not optional. The `/auth/*` routes will **not** appear in the generated document; add a
short prose section to `openApiBase.info.description` pointing at the website for account and token
management, so the published API reference (the self-hosted `apps/docs` Worker and the Scalar
registry copy) is not silently misleading.

### 9.4 Env and bindings

The registry has no `env.ts` today because it had no secrets. Auth introduces four, set with
`wrangler secret put` and surfaced on the generated `Env` type:

```ts
// src/env.ts
import { z } from "zod";

const envSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
});

// Bindings only exist inside a request, so this validates per request rather
// than at module scope; the cache keeps it to once per isolate.
const cache = new WeakMap<Env, z.infer<typeof envSchema>>();

export function parseEnv(env: Env): z.infer<typeof envSchema> {
  const hit = cache.get(env);
  if (hit) return hit;
  const parsed = envSchema.parse(env);
  cache.set(env, parsed);
  return parsed;
}
```

`pnpm gen-types` after declaring the secrets in `wrangler.toml`, and commit `worker-configuration.d.ts`.

### 9.5 Credential resolution

One middleware, colocated with the routes it guards:

```ts
type Actor = { userId: string; handle: string; scopes: Scope[]; via: "token" | "session" };

export const requireScope =
  (scope: Scope): MiddlewareHandler<{ Bindings: Env; Variables: { actor: Actor } }> =>
  async (c, next) => {
    const actor = await resolveActor(c); // bearer token first, then session cookie
    if (!actor) throw new UnauthorizedError("Authentication required");
    if (!actor.scopes.includes(scope))
      throw new ForbiddenError(`Token is missing the ${scope} scope`);
    c.set("actor", actor);
    await next();
  };
```

`resolveActor` is the only place that knows Better Auth exists. Swapping to the hand-rolled fallback
in 4.2 means rewriting this function and nothing else.

### 9.6 Tests

Under `tests/`, Vitest, no runtime required:

- Ownership rules against the in-memory store: first publish claims, second publisher gets 403,
  maintainer may publish, non-maintainer may not, reserved name rejected, soft-deleted package 404s.
- Transfer: nominate then accept, single-owner invariant holds, non-owner cannot nominate.
- `resolveActor`: missing header, malformed header, wrong scope, expired token, each mapping to the
  right status.
- One integration test per new route asserting the JSend envelope shape.

## 10. Tokens in publishers' hands

### 10.0 Today's publishers: CI and real terminals (updated 2026-08-27)

The shipped `cpm` client has no publish command, so the token consumers that exist right now are:

- **The release workflow.** `release.yml` publishes the `cpm` package to the registry on every
  cpm-cli release (via `publish-package.yml`, which runs the cpm tool in `apps/cpm-tool`; target
  from the `CPM_REGISTRY_URL` repository variable). Once auth ships this needs a `publish`-scoped
  token in a GitHub Actions secret (`CPM_REGISTRY_TOKEN`), sent as `Authorization: Bearer`, and the
  `cpm` package needs a real owner account, claimed by first authenticated publish like any other
  package. The tool's 409-means-already-published idempotency is unaffected, since a valid token hits
  the same 409 on re-runs; but an expired CI token turns every release publish into a 401, so the
  token's expiry needs a calendar owner (or a deliberately long expiry, see open questions).
- **Authors at a terminal**, with the cpm tool (`apps/cpm-tool`, since 2026-09-02): create a token
  on the website, `cpm login` pastes and verifies it (`GET /me`) and saves it per registry in the
  user config file; `cpm publish` sends it as `Authorization: Bearer`. `CPM_REGISTRY_TOKEN` overrides
  the saved login for CI. Ordinary npm-style workflow.

Everything below about Minecraft computers applies **only if an in-game publish surface ships later**
(the client design leaves this open). It is kept because it is the hard case, and because the scoping
and hygiene rules it forces (10.3, 10.4) are the right defaults for CI secrets too.

### 10.1 Getting a token onto an in-game computer (future surface)

**v1, paste-a-token** (this is exactly npm's model):

1. Sign in on the registry website with GitHub.
2. Create a token: choose a name, a scope, and an expiry. The raw value is shown **once**.
3. In game: `cpm login`, paste at the prompt. CC:Tweaked supports pasting into the terminal from the
   system clipboard, so this is a real workflow, not a per-character transcription.
4. The client writes it to disk and verifies it with `GET /me`.

**v2, device flow** (Better Auth's `deviceAuthorization` plugin, RFC 8628). Removes the paste:

1. `cpm login` calls `POST /device/code`, prints `Go to <verification_uri> and enter ABCD-1234`.
2. The player alt-tabs, signs in, approves.
3. The computer polls `POST /device/token`, honouring `interval` and backing off on `slow_down`.
4. On approval it receives a session token, **immediately exchanges it for a long-lived publish-scoped
   API key**, stores only the key, and discards the session.

That last step matters: the device flow yields a session credential, and a session is the wrong thing
to leave sitting in a text file on a public computer. The durable artifact should be a narrowly scoped,
independently revocable key. Verify at implementation time that the device plugin's returned token can
authenticate a `createApiKey` call; if not, add a registry endpoint that mints the key server-side on
approval and returns it in the poll response.

### 10.2 Where it lives on the computer

`/.cpm/credentials`, a table keyed by registry host so a private registry can coexist:

```lua
{ ["registry.cpm.chungindustries.com"] = { token = "cpm_...", scope = "publish", expires = 1790000000 } }
```

**This file is readable by anyone who can reach the computer.** CC:Tweaked's `fs` API has no
permissions model, a disk drive can copy it, and anyone with the world save has it outright. There is
no fix for this, only containment. Never log the token, never echo it at the prompt, and never put it
in a URL.

### 10.3 Scopes

| Scope     | Grants                                                            | Default?        |
| --------- | ----------------------------------------------------------------- | --------------- |
| `publish` | Create versions and set dist-tags for packages the user maintains | yes             |
| `manage`  | Add and remove maintainers, transfer, remove                      | no              |
| `admin`   | Reserved-name overrides, registry-wide operations                 | no, humans only |

Reads need no scope. A publish token is publish-only unless the user deliberately widens it, so the
blast radius of the expected leak is "someone publishes a bad version of a package you maintain",
which is recoverable, rather than "someone takes your packages", which is not.

Package-scoped tokens (npm granular style, a token limited to a named list of packages) are the
obvious next tightening. The `permissions` field on Better Auth's API keys can carry the list, so this
is additive; not v1.

### 10.4 Expiry, revocation, and hygiene

- **Default expiry 90 days**, matching where npm landed for write-capable tokens. Maximum 1 year.
  No non-expiring tokens.
- **Revocation is immediate**: the key row is deleted or flagged, and the next verify fails. If a KV
  verification cache is added later, that cache must be invalidated on revoke or given a TTL short
  enough that "revoked" means something.
- **One token per computer**, named after the computer, so the account page reads like an inventory
  and revocation is surgical.
- Show **last used at** and **last used IP** per token. Cheap, and it is how a user notices a leak.
- Token format `cpm_<publicId>_<secret>`: the prefix makes it greppable by secret scanners, and the
  public id lets a user identify a token from a log or a screenshot without exposing the secret.
- Stored **hashed** (Better Auth's API key plugin already hashes; if hand-rolled, SHA-256 via Web Crypto
  and look up by hash).
- Rate limit publish per token and token creation per user.

### 10.5 A CC:Tweaked constraint worth writing down

CC:Tweaked caps HTTP uploads at **4 MiB by default** (headers plus body, server-configurable), so an
in-game publish could never carry a tarball much above that. Already handled on main (2026-08): the
registry enforces `MAX_TARBALL_BYTES` and returns a JSend 413 via `PayloadTooLargeError`, and the
extracted size is capped at 512 KiB. Nothing left to do here.

## 11. Rollout

The data wipe removes every compatibility concern, so this is a straight sequence. One `nx release plan`
entry per logical change, per repo convention.

**Phase 0, spike. DONE 2026-08-27, both questions answered yes.** Results, measured on
better-auth 1.6.25 with `@better-auth/api-key` 1.6.25:

- **Bundle**: baseline 784 KiB (128 KiB gzip); with full `better-auth` + api-key plugin
  2820 KiB (449 KiB gzip). Comfortably under the Worker limit.
- **`better-auth/minimal` does NOT work with the native D1 binding**: it bundles smaller
  (352 KiB gzip) and typechecks, but throws `BetterAuthError: Direct database connection requires
Kysely` at runtime, because D1-native support rides on the Kysely path minimal tree-shakes away.
  Use the full entry point (chosen), or minimal plus the Drizzle adapter (a new dependency, not
  worth it at this size).
- **Schema generation works**, with one correction to this document: the standalone
  `@better-auth/cli` package is stale (stuck at 1.4.x) and replaced by the `auth` package. The
  working command, using the throwaway `node:sqlite` config committed as
  `apps/cpm-registry/auth-schema.config.ts`:
  `pnpm dlx auth generate --config auth-schema.config.ts --output migrations/0003_auth.sql -y`
  (renumbered from `0002` after main gained `0002_bundles.sql`).
  The emitted DDL (`user`, `session`, `account`, `verification`, `apikey` plus indexes) applies
  cleanly via `wrangler d1 migrations apply`. Note the generated columns use camelCase quoted
  names and a `date` type keyword; both are fine under SQLite type affinity, and our own tables
  in `0003`/`0004` reference `"user" ("id")` accordingly.
- **Runtime verified on workerd against local D1**: `/auth/ok` responds, `/auth/get-session`
  returns null without a session, and `POST /auth/sign-in/social` produces a correct GitHub
  authorize URL (state + PKCE) and writes its state rows to the `verification` table through the
  native D1 adapter.

**Phase 1, accounts.** `0003_auth.sql`, GitHub OAuth, sessions, and the smallest possible token
stopgap (the UI proper is deferred by decision 2 in section 12; a bare "you are signed in, here is
your new token, copy it now" page served by the Worker is acceptable as a stopgap until the separate
UI app exists). Publish stays open. Nothing user-visible breaks yet.

**Phase 2, ownership.** `0004_ownership.sql` and `0005_provenance.sql`. Wipe D1 and R2. `POST /packages`
requires a `publish`-scoped bearer token; add `GET /me`, `GET /me/packages`; add `UnauthorizedError` /
`ForbiddenError`; register the security scheme; regenerate and commit `openapi.yaml`; update the README
and the API reference (self-hosted by the `apps/docs` Worker, plus the Scalar registry publish in CI).
**Before this release goes out**: mint a `publish`-scoped token, add it as the `CPM_REGISTRY_TOKEN`
repository secret, teach `apps/cpm-cli/scripts/publish.mjs` to send it, and republish `cpm` (first
authenticated publish claims the name for the bot/owner account). Otherwise the next cpm-cli release
fails its registry publish with a 401. **This is the breaking change**, and it is the release that
closes the open publish endpoint.

**Phase 3, publisher tooling.** Readable 401/403 handling in `scripts/publish.mjs`, and whatever
author-side publish tooling emerges from the client design's open question (a small TS CLI on real
machines). No in-game work: the shipped `cpm` client does not publish.

**Phase 4, the rest.** Maintainer management, transfer with accept, deprecate, soft removal, audit
events surfaced wherever the UI ends up.

**Phase 5, device flow (parked).** RFC 8628 login from in game. Only relevant if an in-game publish
surface ships; Better Auth's plugin makes it cheap to add then, so nothing is lost by waiting.

**Phase 6, hardening.** Package-scoped tokens, rate limits, the separate UI app, KV verification
cache if publish volume ever justifies it.

## 12. Decisions and open questions

Resolved 2026-08-27:

1. **Providers: GitHub OAuth only for v1.** No email/password, no email sender. Adding a second
   provider later costs one Better Auth flag plus an email sender.
2. **Browser UI: deferred out of this phase entirely.** No UI deliverable now. If an interim surface
   proves unavoidable (the GitHub redirect landing and showing a freshly minted token once), it is a
   deliberately minimal stopgap page, not a product. The real account/token UI, when it happens, is
   **its own separate app**: not part of `apps/web` (which depends on `@workspace/supabase` and is
   ruled out here anyway) and not grown inside the Worker. Consequence to design for later: a separate
   origin means the auth endpoints need CORS and cookie-domain configuration when that app arrives;
   nothing in this phase should bake in a same-origin assumption.

   **Shipped 2026-09-01 in `apps/cpm-web`** (the registry website), which resolved the origin
   question the other way: instead of CORS and cookie-domain configuration, cpm-web proxies
   `/auth/*` to the registry over its existing service binding (`src/routes/auth.$.ts`), and
   `BETTER_AUTH_URL` is set to the **website's** origin. Every auth cookie and OAuth redirect
   therefore lives on `cpm.chungindustries.com`, the browser never talks to the registry origin,
   and the registry still needs no public CORS. The site's pages are `/signin` (GitHub) and
   `/account` (profile, maintained packages, token mint/reveal-once/revoke); its SSR reads the
   session by forwarding the cookie over the same binding. The GitHub OAuth App callback moves to
   `https://cpm.chungindustries.com/auth/callback/github` accordingly.

3. **Scoped names: no. Names stay flat**, first-publish-wins. `nameParam`, `tarballKey`, and client
   name parsing keep their current shapes. This is the explicit no.
4. **Handles: seeded from the GitHub login at signup, immutable thereafter.** Maintainer references
   stay stable across GitHub renames. Collisions (a GitHub login already taken as a handle by a
   deleted or earlier account) get a numeric suffix.

Still open:

1. **Better Auth schema generation on native D1.** The `generate`-against-throwaway-SQLite workaround
   is plausible but unproven. This is phase 0's second question and the most likely source of friction.
2. **Should `manage` operations be possible from a token at all,** or session-only? Session-only is
   safer (a leaked computer token can never transfer a package away) at the cost of no scripted
   administration. Leaning session-only, listed as bearer-or-session in section 9.1 pending a call.
3. **Admin.** Who holds `admin`, and is it a column on `user` or a hard-coded list of user ids in a
   secret? A column is more honest; a secret is faster to ship.
4. **Token expiry default.** 90 days matches npm, but the main consumer is now the release
   workflow's secret, and an expired CI token silently breaks the registry publish of the next
   cpm-cli release (it degrades to a red job, not data loss). Options: a long-lived (1 year) CI
   token with `last used` visibility, or a calendar reminder, or exempting `admin`-minted CI tokens
   from the cap. Any future in-game tokens have the same problem in a worse shape (a world nobody
   loads for weeks), which argues for 180 days there.
5. **Who owns the `cpm` package?** Resolved 2026-08-27: the personal GitHub-backed account. CI's
   `CPM_REGISTRY_TOKEN` is a publish-scoped token minted by that account.

## Sources

- [Better Auth 1.5 release notes (native Cloudflare D1, `better-auth/minimal`, extracted plugins)](https://better-auth.com/blog/1-5)
- [Better Auth API Key plugin](https://better-auth.com/docs/plugins/api-key) and [advanced features](https://better-auth.com/docs/plugins/api-key/advanced)
- [`@better-auth/api-key` on npm](https://www.npmjs.com/package/@better-auth/api-key)
- [Better Auth Bearer plugin](https://better-auth.com/docs/plugins/bearer)
- [Better Auth Device Authorization plugin (RFC 8628)](https://better-auth.com/docs/plugins/device-authorization)
- [Better Auth Hono integration](https://better-auth.com/docs/integrations/hono)
- [Better Auth on Cloudflare (Hono docs, per-request instantiation)](https://hono.dev/examples/better-auth-on-cloudflare)
- [`better-auth-cloudflare` community package](https://github.com/zpg6/better-auth-cloudflare)
- [npm: about access tokens](https://docs.npmjs.com/about-access-tokens/) and [classic token removal, 90-day cap on write tokens](https://github.blog/changelog/2025-11-05-npm-security-update-classic-token-creation-disabled-and-granular-token-changes/)
- [Auth.js Cloudflare D1 adapter](https://authjs.dev/getting-started/adapters/d1)
- [Cloudflare Access service tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/)
- [CC:Tweaked `http` module](https://tweaked.cc/module/http.html) and [ComputerCraft HTTP API limits](https://wiki.computercraft.cc/HTTP_API)
