import type { Package, PackageSummary, SearchResults } from "@/components/package/schemas";
import type {
  AddVersionInput,
  BlobStore,
  MaintainedPackage,
  Maintainer,
  MaintainerChange,
  RegistryStore,
  RegistryUser,
  SearchOptions,
} from "@/components/package/store/types";
import { ConflictError, ForbiddenError } from "@/errors";

/**
 * In-memory {@link RegistryStore} used by the service unit tests. It mirrors the
 * atomicity contract of the D1 store (duplicate version -> `ConflictError`,
 * non-maintainer publish -> `ForbiddenError`, first publish claims ownership,
 * original author preserved, owner-guarded maintainer writes) without needing
 * a real database, so the tests are fast and portable.
 */
export class InMemoryRegistryStore implements RegistryStore {
  private readonly packages = new Map<string, Package>();
  /** Rows in insertion order, which is the D1 store's `added_at` order. */
  private readonly maintainers = new Map<string, Omit<Maintainer, "handle">[]>();
  private readonly reserved = new Set<string>();
  /** Mirrors the `user` table's id and handle columns, keyed by user id. */
  private readonly users = new Map<string, RegistryUser>();

  /** Test helper mirroring a row in `reserved_names`. */
  reserve(name: string): void {
    this.reserved.add(name);
  }

  /** Test helper mirroring an account signing up (Better Auth writes `user`). */
  addUser(user: RegistryUser): void {
    this.users.set(user.userId, user);
  }

  async list(): Promise<Package[]> {
    return Array.from(this.packages.values(), clone);
  }

  async get(name: string): Promise<Package | null> {
    const pkg = this.packages.get(name);
    return pkg ? clone(pkg) : null;
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
      .filter((pkg) => has(pkg.name) || has(pkg.author) || has(latestEntry(pkg).description))
      // Byte-order tie break, matching SQLite's default collation on `name`.
      .sort((a, b) => rank(a) - rank(b) || (a.name < b.name ? -1 : 1));
    return {
      results: matches.slice(offset, offset + limit).map(summarize),
      total: matches.length,
    };
  }

  async getMaintainers(name: string): Promise<Maintainer[]> {
    const rows = this.maintainers.get(name) ?? [];
    // Owner first, then insertion order (Array.prototype.sort is stable).
    return rows
      .map((row) => this.withHandle(row))
      .sort((a, b) => Number(b.role === "owner") - Number(a.role === "owner"));
  }

  async addMaintainer({ name, userId, actorUserId }: MaintainerChange): Promise<void> {
    const rows = this.requireOwner(name, actorUserId);
    if (rows.some((m) => m.userId === userId)) return;
    this.maintainers.set(name, [...rows, { userId, role: "maintainer" }]);
  }

  async removeMaintainer({ name, userId, actorUserId }: MaintainerChange): Promise<boolean> {
    const rows = this.requireOwner(name, actorUserId);
    const kept = rows.filter((m) => !(m.userId === userId && m.role === "maintainer"));
    this.maintainers.set(name, kept);
    return kept.length < rows.length;
  }

  async userByHandle(handle: string): Promise<RegistryUser | null> {
    const needle = handle.toLowerCase();
    for (const user of this.users.values()) {
      if (user.handle.toLowerCase() === needle) return { ...user };
    }
    return null;
  }

  async isReserved(name: string): Promise<boolean> {
    return this.reserved.has(name);
  }

  async packagesByMaintainer(userId: string): Promise<MaintainedPackage[]> {
    return Array.from(this.maintainers.entries())
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

  /** The D1 store's `IS_OWNER` guard on maintainer writes. */
  private requireOwner(name: string, actorUserId: string): Omit<Maintainer, "handle">[] {
    const rows = this.maintainers.get(name) ?? [];
    if (!rows.some((m) => m.userId === actorUserId && m.role === "owner")) {
      throw new ForbiddenError(`Only the owner of "${name}" can manage its maintainers`);
    }
    return rows;
  }

  /** The D1 store's `JOIN user`; tests register every actor with `addUser` first. */
  private withHandle(row: Omit<Maintainer, "handle">): Maintainer {
    const user = this.users.get(row.userId);
    if (!user) throw new Error(`User ${row.userId} has no handle, call addUser first`);
    return { userId: row.userId, handle: user.handle, role: row.role };
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
