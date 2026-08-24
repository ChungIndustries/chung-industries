import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";

import { createTar } from "nanotar";
import { beforeEach, describe, expect, it } from "vitest";

import { parseBundle, readBundleFile } from "@/components/package/bundle";
import type { PackageVersionMetadata } from "@/components/package/schemas";
import { MAX_TARBALL_BYTES, PackageService } from "@/components/package/service";
import { InMemoryBlobStore, InMemoryRegistryStore } from "@/components/package/store/memory";
import { tarballKey } from "@/components/package/store/types";

const sha512 = (data: Uint8Array) => `sha512-${createHash("sha512").update(data).digest("base64")}`;
const sha1 = (data: Uint8Array) => createHash("sha1").update(data).digest("hex");
const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
const text = (data: Uint8Array) => new TextDecoder().decode(data);

/** A raw gzipped tarball of exactly the given files, no manifest injected. */
function tgz(files: Record<string, string>): Uint8Array {
  const tar = createTar(Object.entries(files).map(([name, data]) => ({ name, data })));
  return new Uint8Array(gzipSync(tar));
}

/** A publishable tarball: the given files plus the cpm.json the build tooling would emit. */
function pack(manifest: PackageVersionMetadata, files: Record<string, string>): Uint8Array {
  return tgz({ "cpm.json": JSON.stringify(manifest), ...files });
}

/**
 * A raw 512-byte ustar header with an arbitrary typeflag; tar-writing libraries
 * only emit regular files, so link entries have to be crafted by hand.
 */
function tarHeader(name: string, typeflag: string): Uint8Array {
  const header = new Uint8Array(512);
  const write = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) header[offset + i] = value.charCodeAt(i);
  };
  write(0, name);
  write(100, "0000644\0");
  write(108, "0000000\0");
  write(116, "0000000\0");
  write(124, "00000000000\0"); // size 0: link entries carry no data blocks
  write(136, "00000000000\0");
  write(148, "        "); // checksum counts as spaces while summing
  write(156, typeflag);
  write(257, "ustar\0");
  write(263, "00");
  const sum = header.reduce((a, b) => a + b, 0);
  write(148, `${sum.toString(8).padStart(6, "0")}\0 `);
  return header;
}

function meta(
  version: string,
  extra: Partial<PackageVersionMetadata> = {},
): PackageVersionMetadata {
  return { name: "example", version, author: "chungindustries", ...extra };
}

describe("PackageService", () => {
  let service: PackageService;
  let blobs: InMemoryBlobStore;

  beforeEach(() => {
    blobs = new InMemoryBlobStore();
    service = new PackageService(new InMemoryRegistryStore(), blobs);
  });

  it("round-trips publish -> resolve latest -> download with a matching checksum", async () => {
    const v1 = pack(meta("1.0.0"), { "init.lua": "return { version = '1.0.0' }" });
    const v2 = pack(meta("1.2.0"), { "init.lua": "return { version = '1.2.0' }" });

    await service.publish(meta("1.0.0"), v1);
    const pkg = await service.publish(meta("1.2.0"), v2);

    // dist-tags.latest resolves to the newest published version.
    expect(pkg["dist-tags"].latest).toBe("1.2.0");

    // Integrity + shasum are recorded from the tarball bytes on publish.
    const latestVersion = pkg["dist-tags"].latest;
    const dist = pkg.versions[latestVersion]?.dist;
    expect(dist).toBeDefined();
    expect(dist?.tarball.integrity).toBe(sha512(v2));
    expect(dist?.tarball.shasum).toBe(sha1(v2));
    expect(dist?.tarball.url).toBe("/packages/example/1.2.0/dist/tarball");

    // Downloading the resolved latest returns the exact bytes, checksum verified.
    const downloaded = await service.readTarball("example", latestVersion);
    expect(sha512(downloaded)).toBe(dist?.tarball.integrity);
  });

  it("uses the tarball's cpm.json as the metadata source of truth", async () => {
    // No meta form field at all: everything comes from the manifest.
    const manifest = meta("1.4.0", { dependencies: { "cc-http": "^1.0.0" } });
    const pkg = await service.publish(undefined, pack(manifest, { "init.lua": "return {}" }));

    expect(pkg.name).toBe("example");
    expect(pkg["dist-tags"].latest).toBe("1.4.0");
    expect(pkg.versions["1.4.0"]?.dependencies).toEqual({ "cc-http": "^1.0.0" });
  });

  it("rejects tarballs without cpm.json, with invalid cpm.json, or with mismatched meta", async () => {
    await expect(
      service.publish(undefined, tgz({ "init.lua": "return {}" })),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.publish(undefined, tgz({ "cpm.json": "not json", "init.lua": "x" })),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.publish(undefined, tgz({ "cpm.json": '{"name":"example"}', "init.lua": "x" })),
    ).rejects.toMatchObject({ status: 400 });
    // The optional meta cross-check must agree with the manifest.
    await expect(
      service.publish(meta("2.0.0"), pack(meta("1.0.0"), { "init.lua": "x" })),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects dotted package names (reserved until namespaced installs exist)", async () => {
    const dotted: PackageVersionMetadata = { name: "chung.maps", version: "1.0.0" };
    await expect(
      service.publish(undefined, pack(dotted, { "init.lua": "x" })),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("derives a bundle the client can slice files out of, with its digest recorded", async () => {
    const files = {
      "init.lua": "return require('example.util')",
      "util.lua": "return {}",
      "bin/example.lua": "print('hi')",
      "assets/blob.bin": "not lua at all",
    };
    const pkg = await service.publish(meta("1.0.0"), pack(meta("1.0.0"), files));
    const dist = pkg.versions["1.0.0"]!.dist;
    expect(dist.bundle.url).toBe("/packages/example/1.0.0/dist/bundle");

    const bundle = await service.readBundle("example", "1.0.0");
    expect(dist.bundle.sha256).toBe(sha256(bundle));
    expect(dist.bundle.size).toBe(bundle.byteLength);

    const { manifest } = parseBundle(bundle);
    expect(manifest).toMatchObject({ name: "example", version: "1.0.0" });
    // Sorted paths keep the digest deterministic regardless of tar entry order.
    // cpm.json ships in the bundle too, so installed packages are self-describing.
    expect(manifest.files.map((f) => f.path)).toEqual([
      "assets/blob.bin",
      "bin/example.lua",
      "cpm.json",
      "init.lua",
      "util.lua",
    ]);
    for (const [path, content] of Object.entries(files)) {
      expect(text(readBundleFile(bundle, path)!)).toBe(content);
    }
  });

  it("never stores a bundle path that escapes the package directory", async () => {
    // nanotar resolves `..` and strips leading slashes while parsing; our own
    // validator is the second layer. Either way the manifest must come out clean.
    await service.publish(
      undefined,
      pack(meta("1.0.0"), {
        "../startup.lua": "evil",
        "/etc/startup.lua": "evil",
        "./ok.lua": "fine",
      }),
    );
    const { manifest } = parseBundle(await service.readBundle("example", "1.0.0"));
    expect(manifest.files.map((f) => f.path)).toEqual([
      "cpm.json",
      "etc/startup.lua",
      "ok.lua",
      "startup.lua",
    ]);
  });

  it("rejects tarballs containing link entries instead of silently dropping them", async () => {
    // A symlink header prepended to an otherwise valid archive.
    const plain = createTar([{ name: "init.lua", data: "return {}" }]);
    const tar = new Uint8Array(512 + plain.byteLength);
    tar.set(tarHeader("link.lua", "2"), 0);
    tar.set(plain, 512);
    await expect(
      service.publish(meta("1.0.0"), new Uint8Array(gzipSync(tar))),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects tarballs with no files or invalid gzip", async () => {
    await expect(service.publish(meta("1.0.0"), tgz({}))).rejects.toMatchObject({ status: 400 });
    await expect(
      service.publish(meta("1.0.0"), new TextEncoder().encode("not gzip")),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects tarballs over the extracted size cap", async () => {
    const big = pack(meta("1.0.0"), { "big.lua": "-- ".padEnd(600 * 1024, "x") });
    await expect(service.publish(meta("1.0.0"), big)).rejects.toMatchObject({ status: 400 });
  });

  it("keeps dist-tags.latest pointing at the highest stable version", async () => {
    const lib = (v: string) => pack(meta(v), { "a.lua": v });
    await service.publish(meta("1.0.0"), lib("1.0.0"));
    await service.publish(meta("1.2.0"), lib("1.2.0"));
    await service.publish(meta("1.1.0"), lib("1.1.0"));
    const afterStable = await service.publish(meta("2.0.0-beta.1"), lib("2.0.0-beta.1"));

    // A prerelease must not become latest while a stable release exists.
    expect(afterStable["dist-tags"].latest).toBe("1.2.0");
  });

  it("rejects re-publishing an existing version and leaves the stored tarball intact", async () => {
    const original = pack(meta("1.0.0"), { "init.lua": "original" });
    await service.publish(meta("1.0.0"), original);

    await expect(
      service.publish(meta("1.0.0"), pack(meta("1.0.0"), { "init.lua": "overwrite attempt" })),
    ).rejects.toMatchObject({ status: 409 });

    // The stored tarball was never touched by the rejected publish.
    const stored = await service.readTarball("example", "1.0.0");
    expect(sha1(stored)).toBe(sha1(original));
  });

  it("rejects an empty tarball", async () => {
    await expect(service.publish(meta("1.0.0"), new Uint8Array())).rejects.toMatchObject({
      status: 400,
    });
  });

  // The size check runs before gzip validation, so raw zero bytes exercise it.
  // Main's companion "accepts exactly at the limit" test is gone on purpose: a
  // valid publish now also has to be a real gzipped tar within the 512 KiB
  // extracted cap, so a 5 MiB at-limit artifact cannot exist.
  it("rejects a tarball over the size limit and stores nothing", async () => {
    const oversized = new Uint8Array(MAX_TARBALL_BYTES + 1);

    await expect(service.publish(meta("1.0.0"), oversized)).rejects.toMatchObject({ status: 413 });

    // The rejected publish never reached the index or the tarball store.
    await expect(service.get("example")).rejects.toMatchObject({ status: 404 });
    expect(await blobs.get(tarballKey("example", sha1(oversized)))).toBeNull();
  });

  it("returns 404 for unknown packages, versions, and artifacts", async () => {
    await expect(service.get("missing")).rejects.toMatchObject({ status: 404 });

    await service.publish(meta("1.0.0"), pack(meta("1.0.0"), { "a.lua": "x" }));
    await expect(service.getVersion("example", "9.9.9")).rejects.toMatchObject({ status: 404 });
    await expect(service.readTarball("example", "9.9.9")).rejects.toMatchObject({ status: 404 });
    await expect(service.readBundle("example", "9.9.9")).rejects.toMatchObject({ status: 404 });
  });

  describe("resolve", () => {
    beforeEach(async () => {
      const put = (manifest: PackageVersionMetadata) =>
        service.publish(undefined, pack(manifest, { "init.lua": `return '${manifest.version}'` }));
      await put({ name: "util", version: "1.0.0" });
      await put({ name: "util", version: "1.5.0" });
      await put({ name: "util", version: "2.0.0" });
      await put({ name: "http", version: "1.0.0", dependencies: { util: "^1.0.0" } });
      await put({
        name: "app",
        version: "1.0.0",
        dependencies: { http: "^1.0.0", util: ">=1.2.0" },
      });
    });

    it("pins the highest version satisfying every requester, dependencies first", async () => {
      const pinned = await service.resolve({ app: "latest" });
      expect(pinned.map((p) => `${p.name}@${p.version}`)).toEqual([
        // util must satisfy both ^1.0.0 (from http) and >=1.2.0 (from app): 1.5.0, not 2.0.0.
        "util@1.5.0",
        "http@1.0.0",
        "app@1.0.0",
      ]);
    });

    it("accepts ranges, exact versions, and dist-tags as specs", async () => {
      expect((await service.resolve({ util: "^1.0.0" }))[0]?.version).toBe("1.5.0");
      expect((await service.resolve({ util: "1.0.0" }))[0]?.version).toBe("1.0.0");
      expect((await service.resolve({ util: "latest" }))[0]?.version).toBe("2.0.0");
    });

    it("fails on conflicting ranges and unknown packages", async () => {
      await expect(service.resolve({ app: "latest", util: "^2.0.0" })).rejects.toMatchObject({
        status: 400,
      });
      await expect(service.resolve({ nope: "latest" })).rejects.toMatchObject({ status: 404 });
      await expect(service.resolve({ util: "not a range" })).rejects.toMatchObject({
        status: 400,
      });
    });
  });

  it("serves the bootstrap installer from the latest cpm package", async () => {
    await expect(service.readInstaller()).rejects.toMatchObject({ status: 404 });

    const cpm = (version: string): PackageVersionMetadata => ({ name: "cpm", version });
    await service.publish(
      undefined,
      pack(cpm("0.1.0"), { "bin/cpm.lua": "print('cpm')", "install.lua": "-- installer v0.1.0" }),
    );
    await service.publish(
      undefined,
      pack(cpm("0.2.0"), { "bin/cpm.lua": "print('cpm')", "install.lua": "-- installer v0.2.0" }),
    );
    expect(text(await service.readInstaller())).toBe("-- installer v0.2.0");
  });
});
