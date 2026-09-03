/**
 * User handles: the human-facing address of an account, seeded from the GitHub
 * login at signup and immutable thereafter (docs/cpm-registry-auth-design.md,
 * decision 4). Everything else references users by `user.id`; the handle only
 * exists so an owner can type "add octocat" instead of an opaque id.
 *
 * Kept free of any Better Auth import so the schema-generation config and the
 * runtime instance can share it, and so the collision rule is testable alone.
 */

/** GitHub login rules: alphanumerics and single hyphens, at most 39 characters. */
export const HANDLE_PATTERN = /^[a-zA-Z0-9](?:-?[a-zA-Z0-9]){0,38}$/;

/**
 * The `user` table's extra column, declared once for both the runtime and the
 * schema generator. It stays an input field on purpose: Better Auth copies a
 * social profile into a new user through the same input filter as a sign-up
 * body, so `input: false` would also drop the login `mapProfileToUser` maps
 * in. Immutability is enforced by the `user.update.before` hook instead, and
 * GitHub OAuth is the only way an account gets created here.
 */
export const userAdditionalFields = {
  handle: { type: "string", required: false },
} as const;

/**
 * Picks the handle a new account gets: the GitHub login itself when free, else
 * the first `login-2`, `login-3`, ... that is (design decision 4, collisions
 * happen when a login was renamed away and re-registered on GitHub).
 */
export async function pickHandle(
  login: string,
  isTaken: (handle: string) => Promise<boolean>,
): Promise<string> {
  if (!(await isTaken(login))) return login;
  for (let n = 2; ; n++) {
    const candidate = `${login}-${n}`;
    if (!(await isTaken(candidate))) return candidate;
  }
}

/** Case-insensitive, matching the `user_handle_uidx` NOCASE index. */
export async function handleTaken(db: D1Database, handle: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 FROM "user" WHERE handle = ? COLLATE NOCASE')
    .bind(handle)
    .first();
  return row !== null;
}
