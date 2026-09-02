import type { Package, PackageSummary, SearchResults } from "@/components/package/schemas";
import type {
  AddVersionInput,
  BlobStore,
  MaintainedPackage,
  Maintainer,
  MaintainerRole,
  RegistryStore,
  SearchOptions,
} from "@/components/package/store/types";
import { ConflictError, ForbiddenError } from "@/errors";

/**
 * In-memory {@link RegistryStore} used by the service unit tests. It mirrors the
 * atomicity contract of the D1 store (duplicate version -> `ConflictError`,
 * non-maintainer publish -> `ForbiddenError`, first publish claims ownership,
 * original author preserved) and its soft-removal visibility rules without
 * needing a real database, so the tests are fast and portable.
 */
export class InMemoryRegistryStore implements RegistryStore {
  private readonly packages = new Map<string, Package>();
  private readonly maintainers = new Map<string, Maintainer[]>();
  private readonly reserved = new Set<string>();
  private readonly removed = new Set<string>();

  /** Test helper mirroring a row in `reserved_names`. */
  reserve(name: string): void {
    this.reserved.add(name);
  }

  /** Test helper mirroring a maintainer row added out of band. */
  addMaintainer(name: string, userId: string, role: MaintainerRole = "maintainer"): void {
    this.maintainers.set(name, [...(this.maintainers.get(name) ?? []), { userId, role }]);
  }

  /**
   * Test helper mirroring `packages.deleted_at` being set: the package, its
   * versions, and its maintainers all stay in place (unserved), exactly like a
   * soft delete in D1. Reserving the name is a separate step, as it is in the
   * real removal (see `reserve`).
   */
  markRemoved(name: string): void {
    if (!this.packages.has(name)) throw new Error(`Cannot remove unknown package "${name}"`);
    this.removed.add(name);
  }

  async list(): Promise<Package[]> {
    return Array.from(this.packages.values())
      .filter((pkg) => !this.removed.has(pkg.name))
      .map(clone);
  }

  async get(name: string): Promise<Package | null> {
    const pkg = this.packages.get(name);
    return pkg && !this.removed.has(name) ? clone(pkg) : null;
  }

  async search(query: string, { limit, offset }: SearchOptions): Promise<SearchResults> {
    const needle = query.toLowerCase();
    const has = (text: string | undefined) => text?.toLowerCase().includes(needle) ?? false;
    // Same tiers as the D1 store's ORDER BY: exact name, name prefix, name
    // substring, then author/description-only matches.
    const rank = (pkg: Package): number => {
      const name = pkg.name.toLowerCase();
      if (name === needle) return 0;
      if (name.startsWith(needle)) return 1;
      if (name.includes(needle)) return 2;
      return 3;
    };
    const matches = Array.from(this.packages.values())
      .filter((pkg) => !this.removed.has(pkg.name))
      .filter((pkg) => has(pkg.name) || has(pkg.author) || has(latestEntry(pkg).description))
      // Byte-order tie break, matching SQLite's default collation on `name`.
      .sort((a, b) => rank(a) - rank(b) || (a.name < b.name ? -1 : 1));
    return {
      results: matches.slice(offset, offset + limit).map(summarize),
      total: matches.length,
    };
  }

  async isRemoved(name: string): Promise<boolean> {
    return this.removed.has(name);
  }

  async getMaintainers(name: string): Promise<Maintainer[]> {
    return [...(this.maintainers.get(name) ?? [])];
  }

  async isReserved(name: string): Promise<boolean> {
    return this.reserved.has(name);
  }

  async packagesByMaintainer(userId: string): Promise<MaintainedPackage[]> {
    return Array.from(this.maintainers.entries())
      .filter(([name]) => !this.removed.has(name))
      .flatMap(([name, rows]) =>
        rows.filter((m) => m.userId === userId).map((m) => ({ name, role: m.role })),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async addVersion({
    name,
    author,
    entry,
    distTags,
    publishedBy,
  }: AddVersionInput): Promise<Package> {
    // Same order as the D1 batch: claim ownership on first publish, then the
    // maintainer guard (403 outranks 409 so nothing leaks to outsiders), then
    // version immutability.
    const held = this.maintainers.get(name) ?? [];
    if (held.length === 0) {
      this.maintainers.set(name, [{ userId: publishedBy, role: "owner" }]);
    } else if (!held.some((m) => m.userId === publishedBy)) {
      throw new ForbiddenError(`You are not a maintainer of "${name}"`);
    }
    const existing = this.packages.get(name);
    if (existing?.versions[entry.version]) {
      throw new ConflictError(
        `Version ${entry.version} of "${name}" is already published and immutable`,
      );
    }
    // Timestamps are stamped at insert, exactly like the D1 store's `now`.
    const now = new Date().toISOString();
    const pkg: Package = {
      name,
      ...((existing?.author ?? author) ? { author: existing?.author ?? author } : {}),
      createdAt: existing?.createdAt ?? now,
      "dist-tags": {
        ...existing?.["dist-tags"],
        ...distTags,
      } as Package["dist-tags"],
      versions: { ...existing?.versions, [entry.version]: { ...entry, createdAt: now } },
    };
    this.packages.set(name, pkg);
    return clone(pkg);
  }
}

/** In-memory {@link BlobStore} for tests. */
export class InMemoryBlobStore implements BlobStore {
  private readonly blobs = new Map<string, Uint8Array>();

  async put(key: string, data: Uint8Array): Promise<void> {
    this.blobs.set(key, data.slice());
  }

  async get(key: string): Promise<Uint8Array | null> {
    const blob = this.blobs.get(key);
    return blob ? blob.slice() : null;
  }
}

function clone(pkg: Package): Package {
  return structuredClone(pkg);
}

function latestEntry(pkg: Package) {
  const latest = pkg.versions[pkg["dist-tags"].latest];
  if (!latest) throw new Error(`Package "${pkg.name}" has a dangling latest tag`);
  return latest;
}

/** The search-result view of a package, mirroring the D1 store's summary query. */
function summarize(pkg: Package): PackageSummary {
  const latest = latestEntry(pkg);
  return {
    name: pkg.name,
    ...(pkg.author ? { author: pkg.author } : {}),
    ...(latest.description ? { description: latest.description } : {}),
    version: latest.version,
    versionCount: Object.keys(pkg.versions).length,
    publishedAt: latest.createdAt,
  };
}
