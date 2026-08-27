-- `versions.author` and `packages.author` are free-text metadata the publisher
-- typed; `published_by` is the authenticated identity that actually published.
-- Keeping both means the display name stays cosmetic and never load-bearing.
-- SET NULL, not the default NO ACTION: provenance anonymizes on account
-- deletion rather than making publishers undeletable.
ALTER TABLE versions ADD COLUMN published_by TEXT REFERENCES "user" (id) ON DELETE SET NULL;

-- Soft delete only (wired up in a later phase): the row survives so the name
-- stays claimed, and blobs are never deleted from R2.
ALTER TABLE packages ADD COLUMN deprecated_message TEXT;
ALTER TABLE packages ADD COLUMN deleted_at         INTEGER;
