import type { Package, PackageVersion } from "@/components/package/schemas";

export interface AddVersionInput {
  name: string;
  author?: string;
  /** The fully-formed version entry, including its computed `dist`. */
  entry: PackageVersion;
  /** R2 object key where the tarball bytes are stored. */
  tarballKey: string;
  /** R2 object key where the derived bundle bytes are stored. */
  bundleKey: string;
  /** The full set of dist-tags the package should have after this publish. */
  distTags: Record<string, string>;
}

/**
 * The package index. Reads assemble the npm-style package document; `addVersion`
 * records a new immutable version atomically.
 */
export interface RegistryStore {
  list(): Promise<Package[]>;
  get(name: string): Promise<Package | null>;
  /**
   * Upserts the package, inserts the immutable version (throws `ConflictError`
   * if that (name, version) already exists), and upserts the dist-tags, all in
   * one atomic unit. Returns the updated package. Does not touch blob bytes.
   */
  addVersion(input: AddVersionInput): Promise<Package>;
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
