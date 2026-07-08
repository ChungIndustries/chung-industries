import { ConflictError } from "../../../errors.js";
import type { Package, PackageVersion } from "../schemas.js";
import { type AddVersionInput, type RegistryStore, tarballPath } from "./types.js";

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
}
interface TagRow {
  package_name: string;
  tag: string;
  version: string;
}

const SELECT_PACKAGES = "SELECT name, author FROM packages";
const SELECT_VERSIONS =
  "SELECT package_name, version, author, dependencies, shasum, integrity FROM versions";
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
    distTags,
  }: AddVersionInput): Promise<Package> {
    const now = Date.now();
    const statements: D1PreparedStatement[] = [
      // Preserve the original author on re-publish: only set it on first insert.
      this.db
        .prepare(
          "INSERT INTO packages (name, author, created_at) VALUES (?, ?, ?) ON CONFLICT(name) DO NOTHING",
        )
        .bind(name, author ?? null, now),
      // No ON CONFLICT: a duplicate (package_name, version) violates the primary
      // key, which is exactly how immutability is enforced.
      this.db
        .prepare(
          "INSERT INTO versions (package_name, version, author, dependencies, shasum, integrity, tarball_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          name,
          entry.version,
          entry.author ?? null,
          entry.dependencies ? JSON.stringify(entry.dependencies) : null,
          entry.dist.shasum,
          entry.dist.integrity,
          tarballKey,
          now,
        ),
    ];
    for (const [tag, version] of Object.entries(distTags)) {
      statements.push(
        this.db
          .prepare(
            "INSERT INTO dist_tags (package_name, tag, version) VALUES (?, ?, ?) ON CONFLICT(package_name, tag) DO UPDATE SET version = excluded.version",
          )
          .bind(name, tag, version),
      );
    }

    try {
      // D1 runs a batch as a single atomic transaction.
      await this.db.batch(statements);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new ConflictError(
          `Version ${entry.version} of "${name}" is already published and immutable`,
        );
      }
      throw err;
    }

    const pkg = await this.get(name);
    if (!pkg) throw new Error(`Package "${name}" missing immediately after publish`);
    return pkg;
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
        tarball: tarballPath(pkg.name, v.version),
        shasum: v.shasum,
        integrity: v.integrity,
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
