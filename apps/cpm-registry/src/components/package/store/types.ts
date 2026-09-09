import type { Package, PackageVersion, SearchResults } from "@/components/package/schemas";

export interface AddVersionInput {
  name: string;
  author?: string;
  /**
   * The fully-formed version entry, including its computed `dist`. The store
   * stamps `createdAt` itself at insert, so the input carries none.
   */
  entry: Omit<PackageVersion, "createdAt">;
  /** R2 object key where the tarball bytes are stored. */
  tarballKey: string;
  /** R2 object key where the derived bundle bytes are stored. */
  bundleKey: string;
  /** The full set of dist-tags the package should have after this publish. */
  distTags: Record<string, string>;
  /** Authenticated user id performing the publish; claims ownership on a new name. */
  publishedBy: string;
}

export type MaintainerRole = "owner" | "maintainer";

export interface Maintainer {
  userId: string;
  handle: string;
  role: MaintainerRole;
}

/** A user as the maintainer endpoints address one: by handle, resolved to an id. */
export interface RegistryUser {
  userId: string;
  /** The stored casing, which may differ from what the caller typed. */
  handle: string;
}

export interface MaintainerChange {
  name: string;
  /** The maintainer being added or removed. */
  userId: string;
  /** The owner performing the change; the store re-checks their role atomically. */
  actorUserId: string;
}

export interface VersionDeprecationChange {
  name: string;
  version: string;
  /** The message to attach, or `null` to clear the deprecation. */
  message: string | null;
  /** The maintainer performing the change; the store re-checks their row atomically. */
  actorUserId: string;
}

/** Like {@link VersionDeprecationChange}, applied to every version of the package. */
export type PackageDeprecationChange = Omit<VersionDeprecationChange, "version">;

/**
 * One `audit_events` row: the append-only record of every state change
 * (docs/cpm-registry-auth-design.md, section 8.5). Every store write that
 * changes state appends one in the same atomic unit as the change, so the log
 * and the tables can never disagree. The table has no foreign keys and
 * snapshots plain strings, so a row outlives the user and package it names.
 *
 * `detail` is the action-specific JSON blob. A first publish writes a `claim`
 * (the name is now the actor's) followed by its `publish`. The deprecation
 * actions carry `version: null` for the package-level form, which covers
 * every version.
 */
export type AuditEvent = { actorUserId: string; packageName: string } & (
  | { action: "claim" | "publish"; detail: { version: string } }
  | { action: "maintainer.add" | "maintainer.remove"; detail: { userId: string } }
  | { action: "deprecate"; detail: { version: string | null; message: string } }
  | { action: "undeprecate"; detail: { version: string | null } }
);

export type AuditAction = AuditEvent["action"];

/** The event a deprecation change records: clearing the message is an `undeprecate`. */
export function deprecationEvent(change: {
  actorUserId: string;
  name: string;
  version: string | null;
  message: string | null;
}): AuditEvent {
  const { actorUserId, name: packageName, version, message } = change;
  return message === null
    ? { actorUserId, packageName, action: "undeprecate", detail: { version } }
    : { actorUserId, packageName, action: "deprecate", detail: { version, message } };
}

/** One row of "packages this user maintains", for `GET /me/packages`. */
export interface MaintainedPackage {
  name: string;
  role: MaintainerRole;
}

export interface SearchOptions {
  limit: number;
  offset: number;
}

/**
 * The package index. Reads assemble the npm-style package document; `addVersion`
 * records a new immutable version atomically.
 *
 * Unpublishing is soft (`packages.unpublished_at`,
 * docs/cpm-registry-auth-design.md, section 8.3): the row, its versions, and
 * the blobs all survive in storage so the name stays claimed and the package
 * can be recovered, but nothing is served. Every read (`list`, `get`,
 * `search`, `packagesByMaintainer`) hides unpublished packages;
 * `isUnpublished` is the only method that sees them.
 */
export interface RegistryStore {
  /** Every package that has not been unpublished. */
  list(): Promise<Package[]>;
  /** The package document, or `null` if the name is unknown or unpublished. */
  get(name: string): Promise<Package | null>;
  /**
   * Case-insensitive substring search over package name, package author, and
   * the description of the `latest` version. `query` arrives trimmed; an empty
   * query matches every package, so this doubles as the paginated index.
   *
   * Ranking: exact name, then name prefix, then other name matches, then
   * author-or-description-only matches, ties by name in byte order. `total`
   * counts every match regardless of the page requested.
   */
  search(query: string, options: SearchOptions): Promise<SearchResults>;
  /** Whether the package exists and has been unpublished; the publish pre-flight check. */
  isUnpublished(name: string): Promise<boolean>;
  /**
   * Upserts the package, inserts the immutable version (throws `ConflictError`
   * if that (name, version) already exists), and upserts the dist-tags, all in
   * one atomic unit. Returns the updated package. Does not touch blob bytes.
   *
   * Ownership is enforced inside the same atomic unit: a first publish of a
   * new name claims `publishedBy` as owner, and a publish by anyone without a
   * `package_maintainers` row throws `ForbiddenError`. This is the race-proof
   * backstop behind the service's friendlier pre-flight checks.
   */
  addVersion(input: AddVersionInput): Promise<Package>;
  /** The package's maintainers, owner first, then in the order they were added. */
  getMaintainers(name: string): Promise<Maintainer[]>;
  /**
   * Adds `userId` as a `maintainer`, a no-op if they already hold a row (the
   * owner included). The owner check is folded into the insert so an actor
   * who lost ownership between the service's pre-flight and the write changes
   * nothing and gets `ForbiddenError`, mirroring `addVersion`.
   */
  addMaintainer(change: MaintainerChange): Promise<void>;
  /**
   * Removes `userId`'s `maintainer` row, guarded by the actor's ownership like
   * {@link addMaintainer}. Never removes an `owner` row: that is a transfer.
   * Resolves to whether a row was removed.
   */
  removeMaintainer(change: MaintainerChange): Promise<boolean>;
  /**
   * Sets or clears one version's `deprecated_message` and records an
   * `audit_events` row, in one atomic unit. The maintainer check is folded
   * into the write like {@link addVersion}'s: an actor who is not a
   * maintainer changes nothing and gets `ForbiddenError`, and an unknown
   * version `NotFoundError`.
   */
  setVersionDeprecation(change: VersionDeprecationChange): Promise<void>;
  /**
   * {@link setVersionDeprecation} for every version of the package at once,
   * which is what a package-level deprecation is. Versions published
   * afterwards are unaffected.
   */
  setPackageDeprecation(change: PackageDeprecationChange): Promise<void>;
  /** Case-insensitive lookup of an account by handle. */
  userByHandle(handle: string): Promise<RegistryUser | null>;
  isReserved(name: string): Promise<boolean>;
  /** Packages the user maintains that have not been unpublished. */
  packagesByMaintainer(userId: string): Promise<MaintainedPackage[]>;
}

/** Blob storage for tarball and bundle bytes, keyed by {@link tarballKey} / {@link bundleKey}. */
export interface BlobStore {
  put(key: string, data: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
}

/**
 * Content-addressed R2 key for a tarball. Deriving the key from the tarball's
 * own SHA-1 means a losing concurrent publish can never overwrite another
 * publish's bytes: identical content maps to the same key (same bytes), and
 * differing content maps to different keys.
 */
export function tarballKey(name: string, shasum: string): string {
  return `${name}/${shasum}.tgz`;
}

/** Content-addressed R2 key for a derived bundle, by the same reasoning as {@link tarballKey}. */
export function bundleKey(name: string, sha256: string): string {
  return `${name}/${sha256}.bundle`;
}

/** Public API download path recorded in a version's `dist.tarball`. */
export function tarballPath(name: string, version: string): string {
  return `/packages/${encodeURIComponent(name)}/${encodeURIComponent(version)}/dist/tarball`;
}

/** Public API download path recorded in a version's `dist.bundle`. */
export function bundlePath(name: string, version: string): string {
  return `/packages/${encodeURIComponent(name)}/${encodeURIComponent(version)}/dist/bundle`;
}
