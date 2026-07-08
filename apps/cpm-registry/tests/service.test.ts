import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it } from "vitest";

import type { PackageVersionMetadata } from "../src/components/package/schemas.js";
import { PackageService } from "../src/components/package/service.js";
import {
  InMemoryRegistryStore,
  InMemoryTarballStore,
} from "../src/components/package/store/memory.js";

const sha512 = (data: Uint8Array) => `sha512-${createHash("sha512").update(data).digest("base64")}`;
const sha1 = (data: Uint8Array) => createHash("sha1").update(data).digest("hex");
const bytes = (text: string) => new TextEncoder().encode(text);
const text = (data: Uint8Array) => new TextDecoder().decode(data);

function meta(version: string): PackageVersionMetadata {
  return { name: "example", version, author: "chungindustries" };
}

describe("PackageService", () => {
  let service: PackageService;

  beforeEach(() => {
    service = new PackageService(new InMemoryRegistryStore(), new InMemoryTarballStore());
  });

  it("round-trips publish -> resolve latest -> download with a matching checksum", async () => {
    const v1 = bytes("example package v1.0.0 contents");
    const v2 = bytes("example package v1.2.0 contents, different bytes");

    await service.publish(meta("1.0.0"), v1);
    const pkg = await service.publish(meta("1.2.0"), v2);

    // dist-tags.latest resolves to the newest published version.
    expect(pkg["dist-tags"].latest).toBe("1.2.0");

    // Integrity + shasum are recorded from the tarball bytes on publish.
    const latestVersion = pkg["dist-tags"].latest;
    const dist = pkg.versions[latestVersion]?.dist;
    expect(dist).toBeDefined();
    expect(dist?.integrity).toBe(sha512(v2));
    expect(dist?.shasum).toBe(sha1(v2));
    expect(dist?.tarball).toBe("/packages/example/1.2.0/dist/tarball");

    // Downloading the resolved latest returns the exact bytes, checksum verified.
    const downloaded = await service.readTarball("example", latestVersion);
    expect(text(downloaded)).toBe("example package v1.2.0 contents, different bytes");
    expect(sha512(downloaded)).toBe(dist?.integrity);
  });

  it("keeps dist-tags.latest pointing at the highest stable version", async () => {
    await service.publish(meta("1.0.0"), bytes("a"));
    await service.publish(meta("1.2.0"), bytes("b"));
    await service.publish(meta("1.1.0"), bytes("c"));
    const afterStable = await service.publish(meta("2.0.0-beta.1"), bytes("d"));

    // A prerelease must not become latest while a stable release exists.
    expect(afterStable["dist-tags"].latest).toBe("1.2.0");
  });

  it("rejects re-publishing an existing version and leaves the stored tarball intact", async () => {
    const original = bytes("the original, immutable bytes");
    await service.publish(meta("1.0.0"), original);

    await expect(
      service.publish(meta("1.0.0"), bytes("a malicious overwrite attempt")),
    ).rejects.toMatchObject({ status: 409 });

    // The stored tarball was never touched by the rejected publish.
    const stored = await service.readTarball("example", "1.0.0");
    expect(text(stored)).toBe("the original, immutable bytes");
  });

  it("rejects an empty tarball", async () => {
    await expect(service.publish(meta("1.0.0"), new Uint8Array())).rejects.toMatchObject({
      status: 400,
    });
  });

  it("returns 404 for unknown packages, versions, and tarballs", async () => {
    await expect(service.get("missing")).rejects.toMatchObject({ status: 404 });

    await service.publish(meta("1.0.0"), bytes("x"));
    await expect(service.getVersion("example", "9.9.9")).rejects.toMatchObject({ status: 404 });
    await expect(service.readTarball("example", "9.9.9")).rejects.toMatchObject({ status: 404 });
  });
});
