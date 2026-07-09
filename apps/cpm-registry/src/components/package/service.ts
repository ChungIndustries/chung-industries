import { computeDigests } from "@/components/package/integrity";
import type { Package, PackageVersion, PackageVersionMetadata } from "@/components/package/schemas";
import {
  type RegistryStore,
  type TarballStore,
  tarballKey,
  tarballPath,
} from "@/components/package/store/types";
import { pickLatest } from "@/components/package/version";
import { BadRequestError, ConflictError, NotFoundError } from "@/errors";

/**
 * Registry business logic, independent of both the HTTP framework and the
 * storage backend: it talks to a {@link RegistryStore} (the index) and a
 * {@link TarballStore} (blob bytes). Production wires these to D1 and R2; tests
 * wire them to in-memory fakes.
 */
export class PackageService {
  constructor(
    private readonly registry: RegistryStore,
    private readonly tarballs: TarballStore,
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

    const existing = await this.registry.get(metadata.name);
    // Published versions are immutable. Reject before any write so the stored
    // tarball is never clobbered; the store's primary key is the atomic backstop
    // for a concurrent publish that slips past this check.
    if (existing?.versions[metadata.version]) {
      throw new ConflictError(
        `Version ${metadata.version} of "${metadata.name}" is already published and immutable`,
      );
    }

    const { shasum, integrity } = computeDigests(data);
    const key = tarballKey(metadata.name, shasum);
    const entry: PackageVersion = {
      ...metadata,
      dist: { tarball: tarballPath(metadata.name, metadata.version), shasum, integrity },
    };

    const versions = existing
      ? [...Object.keys(existing.versions), metadata.version]
      : [metadata.version];
    const latest = pickLatest(versions);

    // The key is content-addressed, so writing bytes before the index commit is
    // safe: a losing racer writes to a different key (different content) or the
    // identical key with identical bytes, never corrupting the winner.
    await this.tarballs.put(key, data);

    return this.registry.addVersion({
      name: metadata.name,
      author: metadata.author,
      entry,
      tarballKey: key,
      distTags: { ...existing?.["dist-tags"], latest },
    });
  }

  async readTarball(name: string, version: string): Promise<Uint8Array> {
    // Resolve the version first (throws 404), then reach for its bytes.
    const entry = await this.getVersion(name, version);
    const data = await this.tarballs.get(tarballKey(name, entry.dist.shasum));
    if (!data) throw new NotFoundError("Tarball not found");
    return data;
  }
}
