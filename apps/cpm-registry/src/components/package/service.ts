import { z } from "@hono/zod-openapi";

import type { Actor } from "@/components/auth/actor";
import {
  MAX_EXTRACTED_BYTES,
  buildBundle,
  collectPackageFiles,
  gunzipLimited,
  readBundleFile,
} from "@/components/package/bundle";
import { computeDigests, sha256Hex } from "@/components/package/integrity";
import { resolveDependencies } from "@/components/package/resolve";
import {
  packageVersionMetadataSchema,
  type Package,
  type PackageVersion,
  type PackageVersionMetadata,
  type SearchResults,
} from "@/components/package/schemas";
import {
  type BlobStore,
  type Maintainer,
  type RegistryStore,
  type RegistryUser,
  type SearchOptions,
  bundleKey,
  bundlePath,
  tarballKey,
  tarballPath,
} from "@/components/package/store/types";
import { pickLatest } from "@/components/package/version";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  PayloadTooLargeError,
} from "@/errors";

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
 * The in-package manifest and authoring-side source of truth: every tarball
 * must carry a `cpm.json` at its root declaring name, version, and (optionally)
 * description, author, and dependencies, so artifacts are self-describing and
 * can never disagree with their registry entry.
 */
export const MANIFEST_FILE = "cpm.json";

function parseManifest(bytes: Uint8Array | undefined): PackageVersionMetadata {
  if (!bytes) throw new BadRequestError(`Tarball is missing ${MANIFEST_FILE} at its root`);
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new BadRequestError(`${MANIFEST_FILE} is not valid JSON`);
  }
  const parsed = packageVersionMetadataSchema.safeParse(json);
  if (!parsed.success) {
    throw new BadRequestError(`${MANIFEST_FILE} is invalid: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

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

  /** Searches the index; see {@link RegistryStore.search} for the matching contract. */
  search(query: string, options: SearchOptions): Promise<SearchResults> {
    return this.registry.search(query.trim(), options);
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

  async publish(actor: Actor, data: Uint8Array): Promise<Package> {
    if (data.byteLength === 0) {
      throw new BadRequestError("Tarball data is missing");
    }
    // Enforced here rather than in the route so every transport is covered.
    if (data.byteLength > MAX_TARBALL_BYTES) {
      throw new PayloadTooLargeError(
        `Tarball exceeds the maximum size of ${MAX_TARBALL_BYTES} bytes`,
      );
    }

    // Unpack up front: an upload that is not a valid, reasonably sized tarball
    // of clean paths is rejected before anything is stored, and the tarball's
    // own cpm.json is the sole metadata source.
    const tar = await gunzipLimited(data, MAX_EXTRACTED_BYTES);
    const files = collectPackageFiles(tar);
    const metadata = parseManifest(files.get(MANIFEST_FILE));
    // The client blindly writes a startup hook pointing at this file, so a
    // dangling reference must fail the publish, not the computer's next boot.
    if (metadata.startup !== undefined && !files.has(metadata.startup)) {
      throw new BadRequestError(
        `${MANIFEST_FILE} declares startup file "${metadata.startup}" but the tarball does not contain it`,
      );
    }

    // Authorization pre-flight, before any blob write so a rejected publish
    // stores nothing and the caller gets a specific message. The guarded
    // inserts in the store are the atomic backstop for anything racing past
    // these reads (docs/cpm-registry-auth-design.md, section 8.4).
    if ((await this.registry.isReserved(metadata.name)) && !actor.scopes.includes("admin")) {
      throw new ForbiddenError(`Package name "${metadata.name}" is reserved`);
    }
    const existing = await this.registry.get(metadata.name);
    if (existing) {
      const maintainers = await this.registry.getMaintainers(metadata.name);
      if (!maintainers.some((m) => m.userId === actor.userId)) {
        throw new ForbiddenError(`You are not a maintainer of "${metadata.name}"`);
      }
    }
    // Published versions are immutable. Reject before any write so the stored
    // tarball is never clobbered; the store's primary key is the atomic backstop
    // for a concurrent publish that slips past this check.
    if (existing?.versions[metadata.version]) {
      throw new ConflictError(
        `Version ${metadata.version} of "${metadata.name}" is already published and immutable`,
      );
    }

    const bundle = buildBundle(metadata, files);
    const bundleSha256 = sha256Hex(bundle);

    const { shasum, integrity } = computeDigests(data);
    const tarKey = tarballKey(metadata.name, shasum);
    const bunKey = bundleKey(metadata.name, bundleSha256);
    // `createdAt` is stamped by the store, so the entry built here has none.
    const entry: Omit<PackageVersion, "createdAt"> = {
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
      publishedBy: actor.userId,
    });
  }

  /** Packages the given user maintains, for `GET /me/packages`. */
  maintainedBy(userId: string) {
    return this.registry.packagesByMaintainer(userId);
  }

  /** The package's maintainers, owner first. Public, like the package itself. */
  async listMaintainers(name: string): Promise<Maintainer[]> {
    await this.get(name);
    return this.registry.getMaintainers(name);
  }

  /**
   * Adds the account behind `handle` as a maintainer (owner only). Idempotent:
   * re-adding a maintainer, or the owner, changes nothing. Returns the updated
   * list.
   */
  async addMaintainer(actor: Actor, name: string, handle: string): Promise<Maintainer[]> {
    await this.requireOwner(actor, name);
    const user = await this.requireUser(handle);
    await this.registry.addMaintainer({ name, userId: user.userId, actorUserId: actor.userId });
    return this.registry.getMaintainers(name);
  }

  /**
   * Removes the account behind `handle` from the maintainers (owner only). The
   * owner row is never removable this way: that is an ownership transfer.
   * Returns the updated list.
   */
  async removeMaintainer(actor: Actor, name: string, handle: string): Promise<Maintainer[]> {
    const maintainers = await this.requireOwner(actor, name);
    const user = await this.requireUser(handle);
    const target = maintainers.find((m) => m.userId === user.userId);
    if (!target) {
      throw new NotFoundError(`"${user.handle}" is not a maintainer of "${name}"`);
    }
    if (target.role === "owner") {
      throw new BadRequestError(
        `"${user.handle}" owns "${name}" and cannot be removed, transfer ownership instead`,
      );
    }
    const removed = await this.registry.removeMaintainer({
      name,
      userId: user.userId,
      actorUserId: actor.userId,
    });
    // Only a concurrent removal gets here; the pre-flight above saw the row.
    if (!removed) throw new NotFoundError(`"${user.handle}" is not a maintainer of "${name}"`);
    return this.registry.getMaintainers(name);
  }

  /**
   * Pre-flight for maintainer changes: the package exists (404) and the actor
   * owns it (403). The store re-checks ownership inside the write itself, so
   * this only decides which error a caller sees, never whether a write lands.
   */
  private async requireOwner(actor: Actor, name: string): Promise<Maintainer[]> {
    await this.get(name);
    const maintainers = await this.registry.getMaintainers(name);
    if (!maintainers.some((m) => m.userId === actor.userId && m.role === "owner")) {
      throw new ForbiddenError(`Only the owner of "${name}" can manage its maintainers`);
    }
    return maintainers;
  }

  private async requireUser(handle: string): Promise<RegistryUser> {
    const user = await this.registry.userByHandle(handle);
    if (!user) throw new NotFoundError(`No account with the handle "${handle}"`);
    return user;
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
