import type { Package } from "@/components/package/schemas";
import type {
  AddVersionInput,
  RegistryStore,
  TarballStore,
} from "@/components/package/store/types";
import { ConflictError } from "@/errors";

/**
 * In-memory {@link RegistryStore} used by the service unit tests. It mirrors the
 * atomicity contract of the D1 store (duplicate version -> `ConflictError`,
 * original author preserved) without needing a real database, so the tests are
 * fast and portable.
 */
export class InMemoryRegistryStore implements RegistryStore {
  private readonly packages = new Map<string, Package>();

  async list(): Promise<Package[]> {
    return Array.from(this.packages.values(), clone);
  }

  async get(name: string): Promise<Package | null> {
    const pkg = this.packages.get(name);
    return pkg ? clone(pkg) : null;
  }

  async addVersion({ name, author, entry, distTags }: AddVersionInput): Promise<Package> {
    const existing = this.packages.get(name);
    if (existing?.versions[entry.version]) {
      throw new ConflictError(
        `Version ${entry.version} of "${name}" is already published and immutable`,
      );
    }
    const pkg: Package = {
      name,
      ...((existing?.author ?? author) ? { author: existing?.author ?? author } : {}),
      "dist-tags": {
        ...existing?.["dist-tags"],
        ...distTags,
      } as Package["dist-tags"],
      versions: { ...existing?.versions, [entry.version]: entry },
    };
    this.packages.set(name, pkg);
    return clone(pkg);
  }
}

/** In-memory {@link TarballStore} for tests. */
export class InMemoryTarballStore implements TarballStore {
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
