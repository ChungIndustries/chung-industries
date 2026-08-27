import { z } from "@hono/zod-openapi";

/**
 * Auth secrets, set with `wrangler secret put` in production and `.dev.vars`
 * locally. They are not declared in wrangler.toml, so the generated `Env` type
 * does not carry them; this module is the single place that reads and
 * validates them (repo convention: nothing else touches raw env).
 *
 * Bindings only exist inside a request, so validation runs per request rather
 * than at module scope; the WeakMap keeps it to once per isolate.
 */
const envSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
});

export type AuthSecrets = z.infer<typeof envSchema>;

const cache = new WeakMap<Env, AuthSecrets>();

export function parseEnv(env: Env): AuthSecrets {
  const hit = cache.get(env);
  if (hit) return hit;
  const parsed = envSchema.parse(env);
  cache.set(env, parsed);
  return parsed;
}
