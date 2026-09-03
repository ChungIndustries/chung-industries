import type {
  Package,
  PackageSummary,
  PackageVersion,
  SearchResults,
} from "@/components/package/schemas";
import {
  type AddVersionInput,
  type MaintainedPackage,
  type Maintainer,
  type MaintainerChange,
  type MaintainerRole,
  type RegistryStore,
  type RegistryUser,
  type SearchOptions,
  bundlePath,
  tarballPath,
} from "@/components/package/store/types";
import { ConflictError, ForbiddenError } from "@/errors";

interface PackageRow {
  name: string;
  author: string | null;
  created_at: number;
}
interface VersionRow {
  package_name: string;
  version: string;
  description: string | null;
  author: string | null;
  dependencies: string | null;
  shasum: string;
  integrity: string;
  bundle_sha256: string;
  bundle_size: number;
  created_at: number;
}
interface TagRow {
  package_name: string;
  tag: string;
  version: string;
}
interface SummaryRow {
  name: string;
  author: string | null;
  description: string | null;
  version: string;
  version_count: number;
  published_at: number;
}

const SELECT_PACKAGES = "SELECT name, author, created_at FROM packages";
const SELECT_VERSIONS =
  "SELECT package_name, version, description, author, dependencies, shasum, integrity, bundle_sha256, bundle_size, created_at FROM versions";
const SELECT_TAGS = "SELECT package_name, tag, version FROM dist_tags";
// Soft-deleted rows are kept (name stays claimed, blobs stay in storage) but
// every read filters them out, downloads included; see RegistryStore.
const NOT_REMOVED = "deleted_at IS NULL";

// One row per package joined to its `latest` version, which is where the
// description lives. Bound parameters: ?1 lowercased query, ?2 substring LIKE
// pattern, ?3 prefix LIKE pattern (both escaped by `likePattern`). SQLite's LIKE
// and lower() are case-insensitive for ASCII only, which covers package names
// (restricted to ASCII) and is accepted for author and description text.
const FROM_SUMMARIES = `
  FROM packages p
  JOIN dist_tags t ON t.package_name = p.name AND t.tag = 'latest'
  JOIN versions v ON v.package_name = p.name AND v.version = t.version
  WHERE p.${NOT_REMOVED}
    AND (?1 = ''
      OR p.name LIKE ?2 ESCAPE '\\'
      OR p.author LIKE ?2 ESCAPE '\\'
      OR v.description LIKE ?2 ESCAPE '\\')`;
const SELECT_SUMMARIES = `
  SELECT p.name, p.author, v.description, v.version, v.created_at AS published_at,
    (SELECT COUNT(*) FROM versions WHERE package_name = p.name) AS version_count
  ${FROM_SUMMARIES}
  ORDER BY CASE
      WHEN lower(p.name) = ?1 THEN 0
      WHEN p.name LIKE ?3 ESCAPE '\\' THEN 1
      WHEN p.name LIKE ?2 ESCAPE '\\' THEN 2
      ELSE 3
    END, p.name
  LIMIT ?4 OFFSET ?5`;
const COUNT_SUMMARIES = `SELECT COUNT(*) AS total ${FROM_SUMMARIES}`;

/**
 * Guard folded into maintainer writes: the acting user, bound at `?<actorParam>`,
 * must hold the owner row of the package bound at `?1`.
 */
function isOwner(actorParam: number): string {
  return `EXISTS (
    SELECT 1 FROM package_maintainers o
    WHERE o.package_name = ?1 AND o.user_id = ?${actorParam} AND o.role = 'owner')`;
}

/** Escapes the LIKE wildcards in a user-supplied needle so they match literally. */
export function likePattern(needle: string): string {
  return needle.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** D1-backed package index. Metadata only; tarball bytes live in R2. */
export class D1RegistryStore implements RegistryStore {
  constructor(private readonly db: D1Database) {}

  async list(): Promise<Package[]> {
    // Versions and tags of removed packages are fetched and then dropped by
    // the per-package filter below, which is fine: removals are rare.
    const results = await this.db.batch<PackageRow | VersionRow | TagRow>([
      this.db.prepare(`${SELECT_PACKAGES} WHERE ${NOT_REMOVED}`),
      this.db.prepare(SELECT_VERSIONS),
      this.db.prepare(SELECT_TAGS),
    ]);
    const pkgRows = (results[0]?.results ?? []) as PackageRow[];
    const versionRows = (results[1]?.results ?? []) as VersionRow[];
    const tagRows = (results[2]?.results ?? []) as TagRow[];
    return pkgRows.map((pkg) =>
      assemble(
        pkg,
        versionRows.filter((v) => v.package_name === pkg.name),
        tagRows.filter((t) => t.package_name === pkg.name),
      ),
    );
  }

  async get(name: string): Promise<Package | null> {
    const pkgRow = await this.db
      .prepare(`${SELECT_PACKAGES} WHERE name = ? AND ${NOT_REMOVED}`)
      .bind(name)
      .first<PackageRow>();
    if (!pkgRow) return null;

    const results = await this.db.batch<VersionRow | TagRow>([
      this.db.prepare(`${SELECT_VERSIONS} WHERE package_name = ?`).bind(name),
      this.db.prepare(`${SELECT_TAGS} WHERE package_name = ?`).bind(name),
    ]);
    const versionRows = (results[0]?.results ?? []) as VersionRow[];
    const tagRows = (results[1]?.results ?? []) as TagRow[];
    return assemble(pkgRow, versionRows, tagRows);
  }

  async isRemoved(name: string): Promise<boolean> {
    const row = await this.db
      .prepare("SELECT deleted_at FROM packages WHERE name = ?")
      .bind(name)
      .first<{ deleted_at: number | null }>();
    return row !== null && row.deleted_at !== null;
  }

  async search(query: string, { limit, offset }: SearchOptions): Promise<SearchResults> {
    const needle = query.toLowerCase();
    const pattern = likePattern(needle);
    const results = await this.db.batch<SummaryRow | { total: number }>([
      this.db.prepare(SELECT_SUMMARIES).bind(needle, `%${pattern}%`, `${pattern}%`, limit, offset),
      this.db.prepare(COUNT_SUMMARIES).bind(needle, `%${pattern}%`),
    ]);
    const rows = (results[0]?.results ?? []) as SummaryRow[];
    const [count] = (results[1]?.results ?? []) as { total: number }[];
    return { results: rows.map(summarize), total: count?.total ?? 0 };
  }

  async addVersion({
    name,
    author,
    entry,
    tarballKey,
    bundleKey,
    distTags,
    publishedBy,
  }: AddVersionInput): Promise<Package> {
    const now = Date.now();
    // Maintainership is enforced INSIDE the transaction: statement 1 claims
    // ownership only when the package has no maintainers yet (first publish),
    // and statements 2+ only take effect when the publisher holds a
    // maintainer row. A losing racer or a non-maintainer therefore inserts
    // zero version rows, detected below and surfaced as 403; the version
    // primary key stays the 409 backstop for duplicate versions.
    const isMaintainer = `EXISTS (SELECT 1 FROM package_maintainers WHERE package_name = ?1 AND user_id = ?2)`;
    const statements: D1PreparedStatement[] = [
      // Preserve the original author on re-publish: only set it on first insert.
      this.db
        .prepare(
          "INSERT INTO packages (name, author, created_at) VALUES (?, ?, ?) ON CONFLICT(name) DO NOTHING",
        )
        .bind(name, author ?? null, now),
      this.db
        .prepare(
          `INSERT INTO package_maintainers (package_name, user_id, role, added_at)
           SELECT ?1, ?2, 'owner', ?3
           WHERE NOT EXISTS (SELECT 1 FROM package_maintainers WHERE package_name = ?1)`,
        )
        .bind(name, publishedBy, now),
      this.db
        .prepare(
          `INSERT INTO versions (package_name, version, description, author, dependencies, shasum, integrity, tarball_key, bundle_sha256, bundle_size, bundle_key, published_by, created_at)
           SELECT ?1, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?2, ?13
           WHERE ${isMaintainer}`,
        )
        .bind(
          name,
          publishedBy,
          entry.version,
          entry.description ?? null,
          entry.author ?? null,
          entry.dependencies ? JSON.stringify(entry.dependencies) : null,
          entry.dist.tarball.shasum,
          entry.dist.tarball.integrity,
          tarballKey,
          entry.dist.bundle.sha256,
          entry.dist.bundle.size,
          bundleKey,
          now,
        ),
    ];
    for (const [tag, version] of Object.entries(distTags)) {
      statements.push(
        this.db
          .prepare(
            // Guarded like the version insert so a rejected publish can never
            // move dist-tags. The WHERE also disambiguates the upsert parse.
            `INSERT INTO dist_tags (package_name, tag, version)
             SELECT ?1, ?3, ?4 WHERE ${isMaintainer}
             ON CONFLICT(package_name, tag) DO UPDATE SET version = excluded.version`,
          )
          .bind(name, publishedBy, tag, version),
      );
    }

    let results: D1Result[];
    try {
      // D1 runs a batch as a single atomic transaction.
      results = await this.db.batch(statements);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new ConflictError(
          `Version ${entry.version} of "${name}" is already published and immutable`,
        );
      }
      throw err;
    }
    if ((results[2]?.meta.changes ?? 0) === 0) {
      throw new ForbiddenError(`You are not a maintainer of "${name}"`);
    }

    const pkg = await this.get(name);
    if (!pkg) throw new Error(`Package "${name}" missing immediately after publish`);
    return pkg;
  }

  async getMaintainers(name: string): Promise<Maintainer[]> {
    const { results } = await this.db
      .prepare(
        `SELECT m.user_id, u.handle, m.role FROM package_maintainers m
         JOIN "user" u ON u.id = m.user_id
         WHERE m.package_name = ?
         ORDER BY m.role = 'owner' DESC, m.added_at, m.user_id`,
      )
      .bind(name)
      .all<{ user_id: string; handle: string | null; role: MaintainerRole }>();
    return results.map((row) => {
      // Only an account from before 0008_handles.sql that was never backfilled.
      if (!row.handle) throw new Error(`User ${row.user_id} has no handle, backfill user.handle`);
      return { userId: row.user_id, handle: row.handle, role: row.role };
    });
  }

  async addMaintainer({ name, userId, actorUserId }: MaintainerChange): Promise<void> {
    // The owner check rides inside the insert, like the maintainer check in
    // addVersion: a zero-change result is either the no-op of re-adding an
    // existing maintainer, or the actor not being the owner (403).
    const result = await this.db
      .prepare(
        `INSERT INTO package_maintainers (package_name, user_id, role, added_at, added_by)
         SELECT ?1, ?2, 'maintainer', ?3, ?4 WHERE ${isOwner(4)}
         ON CONFLICT(package_name, user_id) DO NOTHING`,
      )
      .bind(name, userId, Date.now(), actorUserId)
      .run();
    if (result.meta.changes > 0) return;
    const held = await this.db
      .prepare("SELECT 1 FROM package_maintainers WHERE package_name = ?1 AND user_id = ?2")
      .bind(name, userId)
      .first();
    if (held === null) {
      throw new ForbiddenError(`Only the owner of "${name}" can manage its maintainers`);
    }
  }

  async removeMaintainer({ name, userId, actorUserId }: MaintainerChange): Promise<boolean> {
    // `role = 'maintainer'` keeps the owner row out of reach even for a caller
    // racing past the service's checks; ownership only moves by transfer.
    const result = await this.db
      .prepare(
        `DELETE FROM package_maintainers
         WHERE package_name = ?1 AND user_id = ?2 AND role = 'maintainer' AND ${isOwner(3)}`,
      )
      .bind(name, userId, actorUserId)
      .run();
    if (result.meta.changes > 0) return true;
    // Nothing removed: either the target was not a maintainer, or the actor is
    // not the owner. Only the latter is an authorization failure.
    const owner = await this.db
      .prepare(
        "SELECT 1 FROM package_maintainers WHERE package_name = ?1 AND user_id = ?2 AND role = 'owner'",
      )
      .bind(name, actorUserId)
      .first();
    if (owner === null) {
      throw new ForbiddenError(`Only the owner of "${name}" can manage its maintainers`);
    }
    return false;
  }

  async userByHandle(handle: string): Promise<RegistryUser | null> {
    const row = await this.db
      .prepare('SELECT id, handle FROM "user" WHERE handle = ? COLLATE NOCASE')
      .bind(handle)
      .first<{ id: string; handle: string }>();
    return row ? { userId: row.id, handle: row.handle } : null;
  }

  async isReserved(name: string): Promise<boolean> {
    const row = await this.db
      .prepare("SELECT 1 FROM reserved_names WHERE name = ?")
      .bind(name)
      .first();
    return row !== null;
  }

  async packagesByMaintainer(userId: string): Promise<MaintainedPackage[]> {
    // Maintainer rows outlive a removal (only a hard delete cascades), so the
    // join is what keeps removed packages out of a user's inventory.
    const { results } = await this.db
      .prepare(
        `SELECT m.package_name, m.role FROM package_maintainers m
         JOIN packages p ON p.name = m.package_name
         WHERE m.user_id = ? AND p.${NOT_REMOVED}
         ORDER BY m.package_name`,
      )
      .bind(userId)
      .all<{ package_name: string; role: MaintainerRole }>();
    return results.map((row) => ({ name: row.package_name, role: row.role }));
  }
}

function assemble(pkg: PackageRow, versions: VersionRow[], tags: TagRow[]): Package {
  const versionsMap: Record<string, PackageVersion> = {};
  for (const v of versions) {
    versionsMap[v.version] = {
      name: pkg.name,
      version: v.version,
      ...(v.description ? { description: v.description } : {}),
      ...(v.author ? { author: v.author } : {}),
      ...(v.dependencies
        ? { dependencies: JSON.parse(v.dependencies) as Record<string, string> }
        : {}),
      dist: {
        tarball: {
          url: tarballPath(pkg.name, v.version),
          shasum: v.shasum,
          integrity: v.integrity,
        },
        bundle: {
          url: bundlePath(pkg.name, v.version),
          sha256: v.bundle_sha256,
          size: v.bundle_size,
        },
      },
      createdAt: new Date(v.created_at).toISOString(),
    };
  }
  const distTags: Record<string, string> = {};
  for (const t of tags) distTags[t.tag] = t.version;
  return {
    name: pkg.name,
    ...(pkg.author ? { author: pkg.author } : {}),
    createdAt: new Date(pkg.created_at).toISOString(),
    "dist-tags": distTags as Package["dist-tags"],
    versions: versionsMap,
  };
}

function summarize(row: SummaryRow): PackageSummary {
  return {
    name: row.name,
    ...(row.author ? { author: row.author } : {}),
    ...(row.description ? { description: row.description } : {}),
    version: row.version,
    versionCount: row.version_count,
    publishedAt: new Date(row.published_at).toISOString(),
  };
}

function isUniqueConstraintError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /UNIQUE constraint failed|PRIMARY KEY|constraint failed/i.test(message);
}
