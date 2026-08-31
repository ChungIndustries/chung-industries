-- Optional user-facing description, taken from the cpm.json manifest at
-- publish. Version-level like the rest of the manifest metadata: versions are
-- immutable, so the package-level description shown on the website is simply
-- the latest version's. NULL for versions published before the field existed.

ALTER TABLE versions ADD COLUMN description TEXT;
