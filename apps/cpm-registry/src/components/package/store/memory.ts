import type {
  Package,
  PackageSummary,
  PackageVersion,
  SearchResults,
} from "@/components/package/schemas";
import {
  type AddVersionInput,
  type AuditEvent,
  type BlobStore,
  type MaintainedPackage,
  type Maintainer,
  type MaintainerChange,
  type PackageDeprecationChange,
  type RegistryStore,
  type RegistryUser,
  type SearchOptions,
  type VersionDeprecationChange,
  deprecationEvent,
} from "@/components/package/store/types";
import { ConflictError, ForbiddenError, NotFoundError } from "@/errors";

/**
 * In-memory {@link RegistryStore} used by the service unit tests. It mirrors the
 * atomicity contract of the D1 store (duplicate version -> `ConflictError`,
 * non-maintainer publish -> `ForbiddenError`, first publish claims ownership,
 * original author preserved, owner-guarded maintainer writes,
 * maintainer-guarded deprecation writes, an audit row for every change that
 * lands) and its unpublish visibility rules without needing a real database,
 * so the tests are fast and portable.
 */
export class InMemoryRegistryStore implements RegistryStore {
  private readonly packages = new Map<string, Package>();
  /** Rows in insertion order, which is the D1 store's `added_at` order. */
  private readonly maintainers = new Map<string, Omit<Maintainer, "handle">[]>();
  private readonly reserved = new Set<string>();
  /** Mirrors the `user` table's id and handle columns, keyed by user id. */
  private readonly users = new Map<string, RegistryUser>();
  private readonly unpublished = new Set<string>();
  /** Mirrors `audit_events`, in insertion order, for tests to assert on. */
  readonly audit: AuditEvent[] = [];

  /** Test helper mirroring a row in `reserved_names`. */
  reserve(name: string): void {
    this.reserved.add(name);
  }

  /** Test helper mirroring an account signing up (Better Auth writes `user`). */
  addUser(user: RegistryUser): void {
    this.users.set(user.userId, user);
  }

  /**
   * Test helper mirroring `packages.unpublished_at` being set: the package,
   * its versions, and its maintainers all stay in place (unserved), exactly
   * like an unpublish in D1. Reserving the name is a separate step, as it is
   * in the real unpublish (see `reserve`).
   */
  markUnpublished(name: string): void {
    if (!this.packages.has(name)) throw new Error(`Cannot unpublish unknown package "${name}"`);
    this.unpublished.add(name);
  }

  async list(): Promise<Package[]> {
    return Array.from(this.packages.values())
      .filter((pkg) => !this.unpublished.has(pkg.name))
      .map(clone);
  }

  async get(name: string): Promise<Package | null> {
    const pkg = this.packages.get(name);
    return pkg && !this.unpublished.has(name) ? clone(pkg) : null;
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
      .filter((pkg) => !this.unpublished.has(pkg.name))
      .filter((pkg) => has(pkg.name) || has(pkg.author) || has(latestEntry(pkg).description))
      // Byte-order tie break, matching SQLite's default collation on `name`.
      .sort((a, b) => rank(a) - rank(b) || (a.name < b.name ? -1 : 1));
    return {
      results: matches.slice(offset, offset + limit).map(summarize),
      total: matches.length,
    };
  }

  async isUnpublished(name: string): Promise<boolean> {
    return this.unpublished.has(name);
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
    this.audit.push({
      actorUserId,
      action: "maintainer.add",
      packageName: name,
      detail: { userId },
    });
  }

  async removeMaintainer({ name, userId, actorUserId }: MaintainerChange): Promise<boolean> {
    const rows = this.requireOwner(name, actorUserId);
    const kept = rows.filter((m) => !(m.userId === userId && m.role === "maintainer"));
    if (kept.length === rows.length) return false;
    this.maintainers.set(name, kept);
    this.audit.push({
      actorUserId,
      action: "maintainer.remove",
      packageName: name,
      detail: { userId },
    });
    return true;
  }

  async setVersionDeprecation({
    name,
    version,
    message,
    actorUserId,
  }: VersionDeprecationChange): Promise<void> {
    // Same precedence as the D1 store: a non-maintainer learns nothing about
    // which versions exist.
    this.requireMaintainer(name, actorUserId);
    const entry = this.packages.get(name)?.versions[version];
    if (!entry) throw new NotFoundError(`Version ${version} of "${name}" not found`);
    setDeprecated(entry, message);
    this.audit.push(deprecationEvent({ actorUserId, name, version, message }));
  }

  async setPackageDeprecation({
    name,
    message,
    actorUserId,
  }: PackageDeprecationChange): Promise<void> {
    this.requireMaintainer(name, actorUserId);
    const pkg = this.packages.get(name);
    if (!pkg) throw new NotFoundError("Package not found");
    for (const entry of Object.values(pkg.versions)) setDeprecated(entry, message);
    this.audit.push(deprecationEvent({ actorUserId, name, version: null, message }));
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
      .filter(([name]) => !this.unpublished.has(name))
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
    const claimed = held.length === 0;
    if (claimed) {
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
    const detail = { version: entry.version };
    if (claimed) {
      this.audit.push({ actorUserId: publishedBy, action: "claim", packageName: name, detail });
    }
    this.audit.push({ actorUserId: publishedBy, action: "publish", packageName: name, detail });
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

  /** The D1 store's `isOwner` guard on maintainer writes. */
  private requireOwner(name: string, actorUserId: string): Omit<Maintainer, "handle">[] {
    const rows = this.maintainers.get(name) ?? [];
    if (!rows.some((m) => m.userId === actorUserId && m.role === "owner")) {
      throw new ForbiddenError(`Only the owner of "${name}" can manage its maintainers`);
    }
    return rows;
  }

  /** The D1 store's `isMaintainer` guard on deprecation writes. */
  private requireMaintainer(name: string, actorUserId: string): void {
    const rows = this.maintainers.get(name) ?? [];
    if (!rows.some((m) => m.userId === actorUserId)) {
      throw new ForbiddenError(`You are not a maintainer of "${name}"`);
    }
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

/** `deprecated_message = ?` on one version row: absent, not `undefined`, when cleared. */
function setDeprecated(entry: PackageVersion, message: string | null): void {
  if (message === null) delete entry.deprecated;
  else entry.deprecated = message;
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
    ...(latest.deprecated ? { deprecated: latest.deprecated } : {}),
  };
}
