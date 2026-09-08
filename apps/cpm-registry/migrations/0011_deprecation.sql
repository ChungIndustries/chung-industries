-- Deprecation is per version, as in npm: usually one release is bad and the
-- rest are fine, and a package-level deprecation is every version deprecated
-- with the same message (what `npm deprecate <pkg>` with no version does). The
-- column 0005_provenance.sql put on packages was never written or read, so
-- there is nothing to carry over.
ALTER TABLE versions ADD COLUMN deprecated_message TEXT;
ALTER TABLE packages DROP COLUMN deprecated_message;
