-- User handles: how a person is addressed in the API (maintainer management,
-- later transfers), seeded from the GitHub login at signup and immutable
-- thereafter (docs/cpm-registry-auth-design.md, decision 4). References in
-- other tables stay on `user.id`; the handle is only the human-facing address.
--
-- Nullable because accounts created before this migration have no handle yet;
-- nothing stored knows their GitHub login (`account.accountId` is the numeric
-- GitHub id), so backfill each one by hand once, after deploying:
--   UPDATE "user" SET handle = '<github login>' WHERE id = '<user.id>';
-- GitHub logins are case-insensitive, so uniqueness and lookups are NOCASE;
-- the stored value keeps the login's original casing for display.
--
-- Mirrors `user.additionalFields.handle` in src/components/auth/instance.ts and
-- auth-schema.config.ts; keep the three in sync.

ALTER TABLE "user" ADD COLUMN "handle" TEXT;

CREATE UNIQUE INDEX "user_handle_uidx" ON "user" ("handle" COLLATE NOCASE);
