import type { Package, PackageVersion } from "@/components/package/schemas";
import {
  type AddVersionInput,
  type MaintainedPackage,
  type Maintainer,
  type MaintainerRole,
  type RegistryStore,
  bundlePath,
  tarballPath,
} from "@/components/package/store/types";
import { ConflictError, ForbiddenError } from "@/errors";

interface PackageRow {
  name: string;
  author: string | null;
}
interface VersionRow {
  package_name: string;
  version: string;
  author: string | null;
  dependencies: string | null;
  shasum: string;
  integrity: string;
  bundle_sha256: string;
  bundle_size: number;
}
interface TagRow {
  package_name: string;
  tag: string;
  version: string;
}

const SELECT_PACKAGES = "SELECT name, author FROM packages";
const SELECT_VERSIONS =
  "SELECT package_name, version, author, dependencies, shasum, integrity, bundle_sha256, bundle_size FROM versions";
const SELECT_TAGS = "SELECT package_name, tag, version FROM dist_tags";

/** D1-backed package index. Metadata only; tarball bytes live in R2. */
export class D1RegistryStore implements RegistryStore {
  constructor(private readonly db: D1Database) {}

  async list(): Promise<Package[]> {
    const results = await this.db.batch<PackageRow | VersionRow | TagRow>([
      this.db.prepare(SELECT_PACKAGES),
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
      .prepare(`${SELECT_PACKAGES} WHERE name = ?`)
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
          `INSERT INTO versions (package_name, version, author, dependencies, shasum, integrity, tarball_key, bundle_sha256, bundle_size, bundle_key, published_by, created_at)
           SELECT ?1, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?2, ?12
           WHERE ${isMaintainer}`,
        )
        .bind(
          name,
          publishedBy,
          entry.version,
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
      .prepare("SELECT user_id, role FROM package_maintainers WHERE package_name = ?")
      .bind(name)
      .all<{ user_id: string; role: MaintainerRole }>();
    return results.map((row) => ({ userId: row.user_id, role: row.role }));
  }

  async isReserved(name: string): Promise<boolean> {
    const row = await this.db
      .prepare("SELECT 1 FROM reserved_names WHERE name = ?")
      .bind(name)
      .first();
    return row !== null;
  }

  async packagesByMaintainer(userId: string): Promise<MaintainedPackage[]> {
    const { results } = await this.db
      .prepare(
        "SELECT package_name, role FROM package_maintainers WHERE user_id = ? ORDER BY package_name",
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
    };
  }
  const distTags: Record<string, string> = {};
  for (const t of tags) distTags[t.tag] = t.version;
  return {
    name: pkg.name,
    ...(pkg.author ? { author: pkg.author } : {}),
    "dist-tags": distTags as Package["dist-tags"],
    versions: versionsMap,
  };
}

function isUniqueConstraintError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /UNIQUE constraint failed|PRIMARY KEY|constraint failed/i.test(message);
}
