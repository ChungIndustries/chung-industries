-- The registry says "unpublish", as npm does, for taking a package out of
-- service: "remove" already means `cpm remove <name>` on the client, which
-- uninstalls from a computer. Same column as 0005_provenance.sql, named for
-- what it means: set when the package stops being served, while its rows and
-- blobs stay in storage for recovery and the name stays claimed.
ALTER TABLE packages RENAME COLUMN deleted_at TO unpublished_at;
