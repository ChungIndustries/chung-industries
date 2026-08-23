import {
  MAX_EXTRACTED_BYTES,
  buildBundle,
  gunzipLimited,
  readBundleFile,
} from "@/components/package/bundle";
import { computeDigests, sha256Hex } from "@/components/package/integrity";
import { resolveDependencies } from "@/components/package/resolve";
import type { Package, PackageVersion, PackageVersionMetadata } from "@/components/package/schemas";
import {
  type BlobStore,
  type RegistryStore,
  bundleKey,
  bundlePath,
  tarballKey,
  tarballPath,
} from "@/components/package/store/types";
import { pickLatest } from "@/components/package/version";
import { BadRequestError, ConflictError, NotFoundError, PayloadTooLargeError } from "@/errors";

/**
 * Upper bound on a published tarball, 5 MiB. Real ComputerCraft Lua packages
 * are kilobytes, so this is generous while keeping an unauthenticated publish
 * endpoint from filling the bucket with large blobs.
 */
export const MAX_TARBALL_BYTES = 5 * 1024 * 1024;

/** The package that is cpm itself; its bundle carries the bootstrap installer. */
export const CPM_PACKAGE = "cpm";
export const INSTALLER_FILE = "install.lua";

/**
 * Registry business logic, independent of both the HTTP framework and the
 * storage backend: it talks to a {@link RegistryStore} (the index) and a
 * {@link BlobStore} (tarball and bundle bytes). Production wires these to D1
 * and R2; tests wire them to in-memory fakes.
 */
export class PackageService {
  constructor(
    private readonly registry: RegistryStore,
    private readonly blobs: BlobStore,
  ) {}

  list(): Promise<Package[]> {
    return this.registry.list();
  }

  async get(name: string): Promise<Package> {
    const pkg = await this.registry.get(name);
    if (!pkg) throw new NotFoundError("Package not found");
    return pkg;
  }

  async getVersion(name: string, version: string): Promise<PackageVersion> {
    const pkg = await this.get(name);
    const entry = pkg.versions[version];
    if (!entry) throw new NotFoundError("Package version not found");
    return entry;
  }

  async publish(metadata: PackageVersionMetadata, data: Uint8Array): Promise<Package> {
    if (data.byteLength === 0) {
      throw new BadRequestError("Tarball data is missing");
    }
    // Enforced here rather than in the route so every transport is covered.
    if (data.byteLength > MAX_TARBALL_BYTES) {
      throw new PayloadTooLargeError(
        `Tarball exceeds the maximum size of ${MAX_TARBALL_BYTES} bytes`,
      );
    }

    const existing = await this.registry.get(metadata.name);
    // Published versions are immutable. Reject before any write so the stored
    // tarball is never clobbered; the store's primary key is the atomic backstop
    // for a concurrent publish that slips past this check.
    if (existing?.versions[metadata.version]) {
      throw new ConflictError(
        `Version ${metadata.version} of "${metadata.name}" is already published and immutable`,
      );
    }

    // Derive the client-facing bundle up front: an upload that is not a valid,
    // reasonably sized tarball of clean paths is rejected before anything is stored.
    const tar = await gunzipLimited(data, MAX_EXTRACTED_BYTES);
    const bundle = buildBundle(metadata, tar);
    const bundleSha256 = sha256Hex(bundle);

    const { shasum, integrity } = computeDigests(data);
    const tarKey = tarballKey(metadata.name, shasum);
    const bunKey = bundleKey(metadata.name, bundleSha256);
    const entry: PackageVersion = {
      ...metadata,
      dist: {
        tarball: { url: tarballPath(metadata.name, metadata.version), shasum, integrity },
        bundle: {
          url: bundlePath(metadata.name, metadata.version),
          sha256: bundleSha256,
          size: bundle.byteLength,
        },
      },
    };

    const versions = existing
      ? [...Object.keys(existing.versions), metadata.version]
      : [metadata.version];
    const latest = pickLatest(versions);

    // Keys are content-addressed, so writing bytes before the index commit is
    // safe: a losing racer writes to a different key (different content) or the
    // identical key with identical bytes, never corrupting the winner.
    await Promise.all([this.blobs.put(tarKey, data), this.blobs.put(bunKey, bundle)]);

    return this.registry.addVersion({
      name: metadata.name,
      author: metadata.author,
      entry,
      tarballKey: tarKey,
      bundleKey: bunKey,
      distTags: { ...existing?.["dist-tags"], latest },
    });
  }

  async readTarball(name: string, version: string): Promise<Uint8Array> {
    // Resolve the version first (throws 404), then reach for its bytes.
    const entry = await this.getVersion(name, version);
    const data = await this.blobs.get(tarballKey(name, entry.dist.tarball.shasum));
    if (!data) throw new NotFoundError("Tarball not found");
    return data;
  }

  async readBundle(name: string, version: string): Promise<Uint8Array> {
    const entry = await this.getVersion(name, version);
    const data = await this.blobs.get(bundleKey(name, entry.dist.bundle.sha256));
    if (!data) throw new NotFoundError("Bundle not found");
    return data;
  }

  /** Pins one version per package for the given root dependencies (see `resolve.ts`). */
  resolve(dependencies: Record<string, string>): Promise<PackageVersion[]> {
    return resolveDependencies(dependencies, (name) => this.registry.get(name));
  }

  /**
   * The bootstrap installer is just a file inside the latest `cpm` package, so
   * publishing cpm is all it takes to update what `wget run .../install` serves.
   */
  async readInstaller(): Promise<Uint8Array> {
    const pkg = await this.registry.get(CPM_PACKAGE);
    if (!pkg) throw new NotFoundError("The cpm package has not been published yet");
    const bundle = await this.readBundle(CPM_PACKAGE, pkg["dist-tags"].latest);
    const installer = readBundleFile(bundle, INSTALLER_FILE);
    if (!installer) throw new NotFoundError("The latest cpm package has no installer");
    return installer;
  }
}
