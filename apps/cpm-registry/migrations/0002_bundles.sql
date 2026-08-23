-- Derived bundles for the in-game cpm client.
--
-- At publish the registry derives a "bundle" (length-prefixed JSON manifest plus
-- raw file bytes) from the uploaded tarball and stores it in R2 next to the
-- tarball; see docs/cpm-client-design.md. These columns record where it lives
-- and its digest. The index was empty when this migration was written, so the
-- columns are NOT NULL with placeholder defaults only to satisfy SQLite's
-- ALTER TABLE rules; any row still carrying a placeholder must be republished.

ALTER TABLE versions ADD COLUMN bundle_sha256 TEXT    NOT NULL DEFAULT '';
ALTER TABLE versions ADD COLUMN bundle_size   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE versions ADD COLUMN bundle_key    TEXT    NOT NULL DEFAULT '';
