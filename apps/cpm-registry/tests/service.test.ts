import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { UploadedFile } from "express-fileupload";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PackageVersionMetadata } from "../src/components/package/schemas.js";
import { PackageService } from "../src/components/package/service.js";

function upload(data: Buffer): UploadedFile {
  return {
    name: "pkg.tgz",
    data,
    size: data.length,
    encoding: "7bit",
    tempFilePath: "",
    truncated: false,
    mimetype: "application/gzip",
    md5: createHash("md5").update(data).digest("hex"),
    mv: async () => {},
  } as unknown as UploadedFile;
}

function meta(version: string): PackageVersionMetadata {
  return { name: "example", version, author: "chungindustries" };
}

const sha512 = (data: Buffer) => `sha512-${createHash("sha512").update(data).digest("base64")}`;
const sha1 = (data: Buffer) => createHash("sha1").update(data).digest("hex");

describe("PackageService", () => {
  let storageDir: string;
  let service: PackageService;

  beforeEach(async () => {
    storageDir = await fs.mkdtemp(path.join(os.tmpdir(), "cpm-registry-"));
    service = new PackageService(storageDir);
  });

  afterEach(async () => {
    await fs.rm(storageDir, { recursive: true, force: true });
  });

  it("round-trips publish -> resolve latest -> download with a matching checksum", async () => {
    const v1 = Buffer.from("example package v1.0.0 contents");
    const v2 = Buffer.from("example package v1.2.0 contents, different bytes");

    await service.publish(meta("1.0.0"), upload(v1));
    const pkg = await service.publish(meta("1.2.0"), upload(v2));

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
    expect(downloaded.equals(v2)).toBe(true);
    expect(sha512(downloaded)).toBe(dist?.integrity);
  });

  it("keeps dist-tags.latest pointing at the highest stable version", async () => {
    await service.publish(meta("1.0.0"), upload(Buffer.from("a")));
    await service.publish(meta("1.2.0"), upload(Buffer.from("b")));
    await service.publish(meta("1.1.0"), upload(Buffer.from("c")));
    const afterStable = await service.publish(meta("2.0.0-beta.1"), upload(Buffer.from("d")));

    // A prerelease must not become latest while a stable release exists.
    expect(afterStable["dist-tags"].latest).toBe("1.2.0");
  });

  it("rejects re-publishing an existing version and leaves the stored tarball intact", async () => {
    const original = Buffer.from("the original, immutable bytes");
    await service.publish(meta("1.0.0"), upload(original));

    const clobber = Buffer.from("a malicious overwrite attempt");
    await expect(service.publish(meta("1.0.0"), upload(clobber))).rejects.toMatchObject({
      statusCode: 409,
    });

    // The on-disk tarball was never touched by the rejected publish.
    const stored = await service.readTarball("example", "1.0.0");
    expect(stored.equals(original)).toBe(true);
  });

  it("rejects publishing an empty tarball with 400", async () => {
    await expect(service.publish(meta("1.0.0"), upload(Buffer.alloc(0)))).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("returns 404 for unknown packages, versions, and tarballs", async () => {
    await expect(service.get("missing")).rejects.toMatchObject({ statusCode: 404 });

    await service.publish(meta("1.0.0"), upload(Buffer.from("x")));
    await expect(service.getVersion("example", "9.9.9")).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.readTarball("example", "9.9.9")).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
