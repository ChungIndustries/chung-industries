-- Where `admin` lives (docs/cpm-registry-auth-design.md, section 12,
-- decision 10): Better Auth's admin plugin, whose columns these are. The
-- registry reads only `user.role`: a session whose user holds an admin role
-- gets the `admin` scope (reserved-name publishes, registry-wide reads);
-- publish tokens never do. The ban and impersonation columns come with the
-- plugin and are unused by the registry itself.
--
-- Nothing in the registry grants a role. New accounts get the plugin's
-- default `user`; accounts from before this migration keep NULL, which the
-- plugin reads the same way. Make the first admin by hand right after
-- deploying, then use `/auth/admin/set-role` as that admin for any others:
--   UPDATE "user" SET role = 'admin' WHERE handle = '<github login>';
--
-- Mirrors the `admin()` plugin in src/components/auth/instance.ts and
-- auth-schema.config.ts; keep the three in sync.

ALTER TABLE "user" ADD COLUMN "role" TEXT;

ALTER TABLE "user" ADD COLUMN "banned" INTEGER;

ALTER TABLE "user" ADD COLUMN "banReason" TEXT;

ALTER TABLE "user" ADD COLUMN "banExpires" DATE;

ALTER TABLE "session" ADD COLUMN "impersonatedBy" TEXT;
