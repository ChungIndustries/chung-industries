import fsSync from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";

import type { UploadedFile } from "express-fileupload";
import createHttpError from "http-errors";
import { z } from "zod";

import { env } from "../../env.js";
import { computeDigests } from "./integrity.js";
import {
  packageSchema,
  type Package,
  type PackageVersion,
  type PackageVersionMetadata,
} from "./schemas.js";
import { pickLatest } from "./version.js";

export class PackageService {
  private readonly storageRoot: string;
  private readonly indexPath: string;

  constructor(storageRoot = env.STORAGE_DIR) {
    this.storageRoot = storageRoot;
    this.indexPath = path.join(this.storageRoot, "registry.json");
  }

  async list(): Promise<Package[]> {
    const registry = await this.loadRegistry();
    return Array.from(registry.values());
  }

  async get(name: string): Promise<Package> {
    const registry = await this.loadRegistry();
    const pkg = registry.get(name);
    if (!pkg) {
      throw createHttpError(404, "Package not found");
    }
    return pkg;
  }

  async getVersion(name: string, version: string): Promise<PackageVersion> {
    const pkg = await this.get(name);
    const entry = pkg.versions[version];
    if (!entry) {
      throw createHttpError(404, "Package version not found");
    }
    return entry;
  }

  async publish(metadata: PackageVersionMetadata, tarball: UploadedFile): Promise<Package> {
    if (!tarball.data || tarball.data.length === 0) {
      throw createHttpError(400, "Tarball data is missing");
    }

    const registry = await this.loadRegistry();
    const existing = registry.get(metadata.name);

    // Published versions are immutable: reject re-publishing an existing version
    // before touching disk so the stored tarball is never clobbered.
    if (existing?.versions[metadata.version]) {
      throw createHttpError(
        409,
        `Version ${metadata.version} of "${metadata.name}" is already published and immutable`,
      );
    }

    const { shasum, integrity } = computeDigests(tarball.data);
    await this.persistTarball(metadata, tarball);

    const metaEntry: PackageVersion = {
      ...metadata,
      dist: { tarball: this.getTarballUrl(metadata.name, metadata.version), shasum, integrity },
    };

    if (existing) {
      existing.versions[metadata.version] = metaEntry;
      existing["dist-tags"].latest = pickLatest(Object.keys(existing.versions));
      await this.saveRegistry(registry);
      return existing;
    }

    const newPackage: Package = {
      name: metadata.name,
      author: metadata.author,
      "dist-tags": { latest: metadata.version },
      versions: {
        [metadata.version]: metaEntry,
      },
    };
    registry.set(metadata.name, newPackage);
    await this.saveRegistry(registry);
    return newPackage;
  }

  async readTarball(name: string, version: string): Promise<Buffer> {
    // Validate the version exists (throws 404) before reaching for the file.
    await this.getVersion(name, version);
    const filePath = path.join(this.storageRoot, name, this.getTarballName(name, version));
    try {
      return await fs.readFile(filePath);
    } catch {
      throw createHttpError(404, "Tarball not found");
    }
  }

  private async persistTarball(metadata: PackageVersionMetadata, tarball: UploadedFile) {
    const filename = this.getTarballName(metadata.name, metadata.version);
    const packageDir = path.join(this.storageRoot, metadata.name);
    await fs.mkdir(packageDir, { recursive: true });
    const targetPath = path.join(packageDir, filename);
    await fs.writeFile(targetPath, tarball.data);
  }

  private getTarballName(name: string, version: string) {
    return `${encodeURIComponent(name)}-${encodeURIComponent(version)}.tgz`;
  }

  private getTarballUrl(name: string, version: string) {
    return `/packages/${encodeURIComponent(name)}/${encodeURIComponent(version)}/dist/tarball`;
  }

  private async loadRegistry() {
    const registry = new Map<string, Package>();
    try {
      if (!fsSync.existsSync(this.indexPath)) return registry;
      const data = await fs.readFile(this.indexPath, "utf8");
      const parsed = JSON.parse(data);
      const validated = z.array(packageSchema).safeParse(parsed);
      if (!validated.success) {
        console.error("Failed to load package index: validation error", validated.error.format());
        return registry;
      }
      for (const pkg of validated.data) {
        registry.set(pkg.name, pkg);
      }
    } catch (err) {
      console.error("Failed to load package index", err);
    }
    return registry;
  }

  private async saveRegistry(registry: Map<string, Package>) {
    const dir = path.dirname(this.indexPath);
    await fs.mkdir(dir, { recursive: true });
    const payload = JSON.stringify(Array.from(registry.values()), null, 2);
    const tmpPath = `${this.indexPath}.tmp`;
    await fs.writeFile(tmpPath, payload, "utf8");
    await fs.rename(tmpPath, this.indexPath);
  }
}
