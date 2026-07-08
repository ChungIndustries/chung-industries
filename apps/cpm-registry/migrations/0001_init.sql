-- Initial CPM registry schema.
--
-- A package has many versions and many dist-tags. Published versions are
-- immutable: the composite primary key on `versions` makes a re-publish of an
-- existing (package, version) a constraint violation, which the service maps to
-- HTTP 409. Tarball bytes live in R2; `tarball_key` is the R2 object key.

CREATE TABLE packages (
  name       TEXT    NOT NULL PRIMARY KEY,
  author     TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE versions (
  package_name TEXT    NOT NULL,
  version      TEXT    NOT NULL,
  author       TEXT,
  dependencies TEXT, -- JSON object of { name: semver-range }, or NULL
  shasum       TEXT    NOT NULL,
  integrity    TEXT    NOT NULL,
  tarball_key  TEXT    NOT NULL,
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (package_name, version),
  FOREIGN KEY (package_name) REFERENCES packages (name) ON DELETE CASCADE
);

CREATE TABLE dist_tags (
  package_name TEXT NOT NULL,
  tag          TEXT NOT NULL,
  version      TEXT NOT NULL,
  PRIMARY KEY (package_name, tag),
  FOREIGN KEY (package_name) REFERENCES packages (name) ON DELETE CASCADE
);
