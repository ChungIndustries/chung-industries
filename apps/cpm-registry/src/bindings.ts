/**
 * The Worker's runtime bindings, declared in `wrangler.toml`. `DB` is the D1
 * database holding package metadata; `BUCKET` is the R2 bucket holding tarball
 * bytes. Both are reached in-process via bindings, so there is no inter-service
 * egress. This is the single source of truth for what the Worker can access.
 */
export interface Bindings {
  DB: D1Database;
  BUCKET: R2Bucket;
}
