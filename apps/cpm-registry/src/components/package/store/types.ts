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
  role: MaintainerRole;
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
 * Removal is soft (`packages.deleted_at`, docs/cpm-registry-auth-design.md,
 * section 8.3): the row, its versions, and the blobs all survive so the name
 * stays claimed and already-published artifacts stay downloadable. The index
 * reads (`list`, `get`, `search`, `packagesByMaintainer`) therefore hide removed
 * packages, and only the explicitly named methods below see them.
 */
export interface RegistryStore {
  /** Every package that has not been removed. */
  list(): Promise<Package[]>;
  /** The package document, or `null` if the name is unknown or removed. */
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
  /**
   * Like {@link get} but also returns a removed package. Only for serving the
   * immutable artifacts of already-published versions; never for the package
   * document, listings, or resolution.
   */
  getIncludingRemoved(name: string): Promise<Package | null>;
  /** Whether the package exists and has been soft-deleted. */
  isRemoved(name: string): Promise<boolean>;
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
  getMaintainers(name: string): Promise<Maintainer[]>;
  isReserved(name: string): Promise<boolean>;
  /** Packages the user maintains that have not been removed. */
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
