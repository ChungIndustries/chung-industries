/**
 * Consumer-side mirror of the registry's response schemas
 * (apps/cpm-registry/src/components/package/schemas.ts): the registry owns the
 * contract and validates on its side, the site only reads. Only the fields the
 * site renders are declared.
 */

export interface TarballDist {
  url: string;
  shasum: string;
  integrity: string;
}

export interface BundleDist {
  url: string;
  sha256: string;
  size: number;
}

export interface PackageVersion {
  name: string;
  version: string;
  author?: string;
  dependencies?: Record<string, string>;
  startup?: string;
  dist: { tarball: TarballDist; bundle: BundleDist };
}

export type DistTags = { latest: string } & Record<string, string>;

export interface Package {
  name: string;
  author?: string;
  "dist-tags": DistTags;
  versions: Record<string, PackageVersion>;
}
