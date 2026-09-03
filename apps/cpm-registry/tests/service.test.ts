import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";

import { createTar } from "nanotar";
import { beforeEach, describe, expect, it } from "vitest";

import type { Actor } from "@/components/auth/actor";
import { parseBundle, readBundleFile } from "@/components/package/bundle";
import type { PackageVersionMetadata } from "@/components/package/schemas";
import { MAX_TARBALL_BYTES, PackageService } from "@/components/package/service";
import { InMemoryBlobStore, InMemoryRegistryStore } from "@/components/package/store/memory";
import { tarballKey } from "@/components/package/store/types";

const OWNER: Actor = { userId: "user-owner", name: "Owner", scopes: ["publish"], via: "token" };
const OTHER: Actor = { userId: "user-other", name: "Other", scopes: ["publish"], via: "token" };
const ADMIN: Actor = {
  userId: "user-admin",
  name: "Admin",
  scopes: ["publish", "admin"],
  via: "session",
};

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
  let registry: InMemoryRegistryStore;

  /** Publishes as OWNER unless a test is specifically about somebody else. */
  const publish = (data: Uint8Array, actor: Actor = OWNER) => service.publish(actor, data);

  beforeEach(() => {
    blobs = new InMemoryBlobStore();
    registry = new InMemoryRegistryStore();
    service = new PackageService(registry, blobs);
    // Every actor is a signed-up account with a handle, as in production.
    registry.addUser({ userId: OWNER.userId, handle: "owner" });
    registry.addUser({ userId: OTHER.userId, handle: "Other-Dev" });
    registry.addUser({ userId: ADMIN.userId, handle: "admin" });
  });

  it("round-trips publish -> resolve latest -> download with a matching checksum", async () => {
    const v1 = pack(meta("1.0.0"), { "init.lua": "return { version = '1.0.0' }" });
    const v2 = pack(meta("1.2.0"), { "init.lua": "return { version = '1.2.0' }" });

    await publish(v1);
    const pkg = await publish(v2);

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
    const manifest = meta("1.4.0", {
      description: "Example utilities",
      dependencies: { "cc-http": "^1.0.0" },
    });
    const pkg = await publish(pack(manifest, { "init.lua": "return {}" }));

    expect(pkg.name).toBe("example");
    expect(pkg["dist-tags"].latest).toBe("1.4.0");
    expect(pkg.versions["1.4.0"]?.description).toBe("Example utilities");
    expect(pkg.versions["1.4.0"]?.dependencies).toEqual({ "cc-http": "^1.0.0" });
  });

  it("leaves the description absent for manifests without one, and rejects a blank one", async () => {
    const pkg = await publish(pack(meta("1.0.0"), { "init.lua": "return {}" }));
    expect(pkg.versions["1.0.0"]?.description).toBeUndefined();

    await expect(
      publish(pack(meta("1.1.0", { description: "" }), { "init.lua": "return {}" })),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("stamps publish timestamps on the package and each version", async () => {
    const before = Date.now();
    const pkg = await publish(pack(meta("1.0.0"), { "init.lua": "return {}" }));
    const after = Date.now();

    // ISO 8601 strings within the publish window; the package keeps its
    // first-publish timestamp while each version records its own.
    for (const stamp of [pkg.createdAt, pkg.versions["1.0.0"]?.createdAt]) {
      expect(Date.parse(stamp!)).toBeGreaterThanOrEqual(before);
      expect(Date.parse(stamp!)).toBeLessThanOrEqual(after);
      expect(stamp).toBe(new Date(Date.parse(stamp!)).toISOString());
    }

    const again = await publish(pack(meta("1.1.0"), { "init.lua": "return {}" }));
    expect(again.createdAt).toBe(pkg.createdAt);
    expect(Date.parse(again.versions["1.1.0"]!.createdAt)).toBeGreaterThanOrEqual(
      Date.parse(pkg.versions["1.0.0"]!.createdAt),
    );
  });

  it("rejects tarballs without cpm.json or with invalid cpm.json", async () => {
    await expect(publish(tgz({ "init.lua": "return {}" }))).rejects.toMatchObject({
      status: 400,
    });
    await expect(publish(tgz({ "cpm.json": "not json", "init.lua": "x" }))).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      publish(tgz({ "cpm.json": '{"name":"example"}', "init.lua": "x" })),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("carries a declared startup file through to the version entry", async () => {
    const manifest = meta("1.0.0", { startup: "startup.lua" });
    const pkg = await publish(
      pack(manifest, { "init.lua": "return {}", "startup.lua": "print('boot')" }),
    );
    expect(pkg.versions["1.0.0"]?.startup).toBe("startup.lua");
  });

  it("rejects a manifest whose startup file is not in the tarball", async () => {
    const manifest = meta("1.0.0", { startup: "startup.lua" });
    await expect(publish(pack(manifest, { "init.lua": "x" }))).rejects.toMatchObject({
      status: 400,
    });
  });

  it("rejects dotted package names (reserved until namespaced installs exist)", async () => {
    const dotted: PackageVersionMetadata = { name: "chung.maps", version: "1.0.0" };
    await expect(publish(pack(dotted, { "init.lua": "x" }))).rejects.toMatchObject({
      status: 400,
    });
  });

  it("derives a bundle the client can slice files out of, with its digest recorded", async () => {
    const files = {
      "init.lua": "return require('example.util')",
      "util.lua": "return {}",
      "bin/example.lua": "print('hi')",
      "assets/blob.bin": "not lua at all",
    };
    const pkg = await publish(pack(meta("1.0.0"), files));
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
    await publish(
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
    await expect(publish(new Uint8Array(gzipSync(tar)))).rejects.toMatchObject({
      status: 400,
    });
  });

  it("rejects tarballs with no files or invalid gzip", async () => {
    await expect(publish(tgz({}))).rejects.toMatchObject({ status: 400 });
    await expect(publish(new TextEncoder().encode("not gzip"))).rejects.toMatchObject({
      status: 400,
    });
  });

  it("rejects tarballs over the extracted size cap", async () => {
    const big = pack(meta("1.0.0"), { "big.lua": "-- ".padEnd(600 * 1024, "x") });
    await expect(publish(big)).rejects.toMatchObject({ status: 400 });
  });

  it("keeps dist-tags.latest pointing at the highest stable version", async () => {
    const lib = (v: string) => pack(meta(v), { "a.lua": v });
    await publish(lib("1.0.0"));
    await publish(lib("1.2.0"));
    await publish(lib("1.1.0"));
    const afterStable = await publish(lib("2.0.0-beta.1"));

    // A prerelease must not become latest while a stable release exists.
    expect(afterStable["dist-tags"].latest).toBe("1.2.0");
  });

  it("rejects re-publishing an existing version and leaves the stored tarball intact", async () => {
    const original = pack(meta("1.0.0"), { "init.lua": "original" });
    await publish(original);

    await expect(
      publish(pack(meta("1.0.0"), { "init.lua": "overwrite attempt" })),
    ).rejects.toMatchObject({ status: 409 });

    // The stored tarball was never touched by the rejected publish.
    const stored = await service.readTarball("example", "1.0.0");
    expect(sha1(stored)).toBe(sha1(original));
  });

  it("rejects an empty tarball", async () => {
    await expect(publish(new Uint8Array())).rejects.toMatchObject({
      status: 400,
    });
  });

  // The size check runs before gzip validation, so raw zero bytes exercise it.
  // Main's companion "accepts exactly at the limit" test is gone on purpose: a
  // valid publish now also has to be a real gzipped tar within the 512 KiB
  // extracted cap, so a 5 MiB at-limit artifact cannot exist.
  it("rejects a tarball over the size limit and stores nothing", async () => {
    const oversized = new Uint8Array(MAX_TARBALL_BYTES + 1);

    await expect(publish(oversized)).rejects.toMatchObject({ status: 413 });

    // The rejected publish never reached the index or the tarball store.
    await expect(service.get("example")).rejects.toMatchObject({ status: 404 });
    expect(await blobs.get(tarballKey("example", sha1(oversized)))).toBeNull();
  });

  it("returns 404 for unknown packages, versions, and artifacts", async () => {
    await expect(service.get("missing")).rejects.toMatchObject({ status: 404 });

    await publish(pack(meta("1.0.0"), { "a.lua": "x" }));
    await expect(service.getVersion("example", "9.9.9")).rejects.toMatchObject({ status: 404 });
    await expect(service.readTarball("example", "9.9.9")).rejects.toMatchObject({ status: 404 });
    await expect(service.readBundle("example", "9.9.9")).rejects.toMatchObject({ status: 404 });
  });

  describe("search", () => {
    const page = { limit: 20, offset: 0 };
    const names = async (query: string, options = page) =>
      (await service.search(query, options)).results.map((r) => r.name);

    beforeEach(async () => {
      const put = (manifest: PackageVersionMetadata) =>
        publish(pack(manifest, { "init.lua": "return {}" }));
      await put({ name: "http", version: "1.0.0", description: "Plain HTTP helpers" });
      await put({ name: "http-client", version: "1.0.0", author: "alice" });
      await put({ name: "cc-http", version: "1.0.0" });
      await put({
        name: "mail",
        version: "1.0.0",
        author: "alice",
        description: "Send letters over HTTP",
      });
      await put({
        name: "mail",
        version: "2.0.0",
        author: "alice",
        description: "Mail over HTTP, now with attachments",
      });
    });

    it("ranks exact, prefix, and substring name matches ahead of description matches", async () => {
      expect(await names("http")).toEqual(["http", "http-client", "cc-http", "mail"]);
    });

    it("matches author and the latest description, case-insensitively", async () => {
      expect(await names("ALICE")).toEqual(["http-client", "mail"]);
      expect(await names("attachments")).toEqual(["mail"]);
      // Only the latest version's description is searched.
      expect(await names("letters")).toEqual([]);
    });

    it("summarizes each package from its latest version", async () => {
      const { results, total } = await service.search("mail", page);
      const pkg = await service.get("mail");
      expect(total).toBe(1);
      expect(results).toEqual([
        {
          name: "mail",
          author: "alice",
          description: "Mail over HTTP, now with attachments",
          version: "2.0.0",
          versionCount: 2,
          publishedAt: pkg.versions["2.0.0"]?.createdAt,
        },
      ]);
    });

    it("lists everything by name for an empty query, with total spanning all pages", async () => {
      expect(await names("")).toEqual(["cc-http", "http", "http-client", "mail"]);
      const { results, total } = await service.search("", { limit: 2, offset: 1 });
      expect(results.map((r) => r.name)).toEqual(["http", "http-client"]);
      expect(total).toBe(4);
    });

    it("trims the query and returns an empty page for no matches", async () => {
      expect(await names("  http  ")).toEqual(await names("http"));
      expect(await service.search("nope", page)).toEqual({ results: [], total: 0 });
    });
  });

  describe("resolve", () => {
    beforeEach(async () => {
      const put = (manifest: PackageVersionMetadata) =>
        publish(pack(manifest, { "init.lua": `return '${manifest.version}'` }));
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

  describe("ownership", () => {
    const lib = (v: string) => pack(meta(v), { "init.lua": `return '${v}'` });

    it("claims a new name for the first authenticated publisher", async () => {
      await publish(lib("1.0.0"));
      expect(await registry.getMaintainers("example")).toEqual([
        { userId: OWNER.userId, handle: "owner", role: "owner" },
      ]);
      expect(await service.maintainedBy(OWNER.userId)).toEqual([
        { name: "example", role: "owner" },
      ]);
    });

    it("rejects a publish to somebody else's package with 403", async () => {
      await publish(lib("1.0.0"));
      await expect(publish(lib("1.1.0"), OTHER)).rejects.toMatchObject({ status: 403 });
      // Ownership is untouched and the version was never recorded.
      expect(await registry.getMaintainers("example")).toEqual([
        { userId: OWNER.userId, handle: "owner", role: "owner" },
      ]);
      await expect(service.getVersion("example", "1.1.0")).rejects.toMatchObject({ status: 404 });
    });

    it("lets an added maintainer publish new versions", async () => {
      await publish(lib("1.0.0"));
      await registry.addMaintainer({
        name: "example",
        userId: OTHER.userId,
        actorUserId: OWNER.userId,
      });
      const pkg = await publish(lib("1.1.0"), OTHER);
      expect(pkg["dist-tags"].latest).toBe("1.1.0");
      // Publishing as a maintainer never reassigns ownership.
      expect(await registry.getMaintainers("example")).toEqual([
        { userId: OWNER.userId, handle: "owner", role: "owner" },
        { userId: OTHER.userId, handle: "Other-Dev", role: "maintainer" },
      ]);
    });

    it("rejects reserved names with 403 unless the actor is an admin", async () => {
      registry.reserve("chung");
      const manifest: PackageVersionMetadata = { name: "chung", version: "1.0.0" };
      await expect(publish(pack(manifest, { "init.lua": "x" }))).rejects.toMatchObject({
        status: 403,
      });
      // The rejection happened before any blob write.
      expect(await service.list()).toEqual([]);

      const pkg = await publish(pack(manifest, { "init.lua": "x" }), ADMIN);
      expect(pkg.name).toBe("chung");
    });

    it("enforces maintainership in the store as the race backstop", async () => {
      // Bypass the service pre-flight and hit the store directly, as a racing
      // request that passed pre-flight before losing the ownership claim would.
      await publish(lib("1.0.0"));
      const entry = (await service.get("example")).versions["1.0.0"]!;
      await expect(
        registry.addVersion({
          name: "example",
          entry: { ...entry, version: "9.9.9" },
          tarballKey: "k",
          bundleKey: "b",
          distTags: { latest: "9.9.9" },
          publishedBy: OTHER.userId,
        }),
      ).rejects.toMatchObject({ status: 403 });
    });
  });

  describe("maintainers", () => {
    const lib = (v: string) => pack(meta(v), { "init.lua": `return '${v}'` });
    // The owner acting from the website (sessions carry `manage`).
    const MANAGER: Actor = { ...OWNER, scopes: ["publish", "manage"], via: "session" };
    const OTHER_MANAGER: Actor = { ...OTHER, scopes: ["publish", "manage"], via: "session" };
    const THIRD = { userId: "user-third", handle: "third" };

    beforeEach(async () => {
      registry.addUser(THIRD);
      await publish(lib("1.0.0"));
    });

    it("lists the owner first, with handles, for anyone", async () => {
      expect(await service.listMaintainers("example")).toEqual([
        { userId: OWNER.userId, handle: "owner", role: "owner" },
      ]);
      await expect(service.listMaintainers("nope")).rejects.toMatchObject({ status: 404 });
    });

    it("lets the owner add a maintainer by handle, case-insensitively and idempotently", async () => {
      const added = await service.addMaintainer(MANAGER, "example", "other-dev");
      const expected = [
        { userId: OWNER.userId, handle: "owner", role: "owner" },
        // The stored casing is what comes back, not what the caller typed.
        { userId: OTHER.userId, handle: "Other-Dev", role: "maintainer" },
      ];
      expect(added).toEqual(expected);
      expect(await service.addMaintainer(MANAGER, "example", "OTHER-DEV")).toEqual(expected);
      // Re-adding the owner is a no-op too, never a demotion.
      expect(await service.addMaintainer(MANAGER, "example", "owner")).toEqual(expected);

      const pkg = await publish(lib("1.1.0"), OTHER);
      expect(pkg["dist-tags"].latest).toBe("1.1.0");
    });

    it("rejects adding from anyone but the owner, and unknown packages or handles", async () => {
      await service.addMaintainer(MANAGER, "example", "other-dev");
      // A maintainer holding the manage scope still is not the owner.
      await expect(
        service.addMaintainer(OTHER_MANAGER, "example", THIRD.handle),
      ).rejects.toMatchObject({ status: 403 });
      await expect(service.addMaintainer(MANAGER, "nope", "other-dev")).rejects.toMatchObject({
        status: 404,
      });
      await expect(service.addMaintainer(MANAGER, "example", "nobody")).rejects.toMatchObject({
        status: 404,
      });
      expect(await service.listMaintainers("example")).toHaveLength(2);
    });

    it("lets only the owner remove a maintainer, who then can no longer publish", async () => {
      await service.addMaintainer(MANAGER, "example", "other-dev");
      await service.addMaintainer(MANAGER, "example", THIRD.handle);
      await expect(
        service.removeMaintainer(OTHER_MANAGER, "example", THIRD.handle),
      ).rejects.toMatchObject({ status: 403 });

      expect(await service.removeMaintainer(MANAGER, "example", "OTHER-dev")).toEqual([
        { userId: OWNER.userId, handle: "owner", role: "owner" },
        { userId: THIRD.userId, handle: THIRD.handle, role: "maintainer" },
      ]);
      await expect(publish(lib("1.1.0"), OTHER)).rejects.toMatchObject({ status: 403 });
      expect(await service.maintainedBy(OTHER.userId)).toEqual([]);
    });

    it("never removes the owner, and 404s for non-maintainers and unknown handles", async () => {
      await expect(service.removeMaintainer(MANAGER, "example", "owner")).rejects.toMatchObject({
        status: 400,
      });
      await expect(service.removeMaintainer(MANAGER, "example", "other-dev")).rejects.toMatchObject(
        { status: 404 },
      );
      await expect(service.removeMaintainer(MANAGER, "example", "nobody")).rejects.toMatchObject({
        status: 404,
      });
      expect(await service.listMaintainers("example")).toEqual([
        { userId: OWNER.userId, handle: "owner", role: "owner" },
      ]);
    });

    it("enforces ownership in the store as the race backstop", async () => {
      // Straight to the store, as a request that passed pre-flight before
      // losing ownership would: neither write lands, and the owner row is
      // untouchable even by the owner's own id.
      const asOther = { name: "example", userId: THIRD.userId, actorUserId: OTHER.userId };
      await expect(registry.addMaintainer(asOther)).rejects.toMatchObject({ status: 403 });
      await expect(registry.removeMaintainer(asOther)).rejects.toMatchObject({ status: 403 });
      expect(
        await registry.removeMaintainer({
          name: "example",
          userId: OWNER.userId,
          actorUserId: OWNER.userId,
        }),
      ).toBe(false);
      expect(await service.listMaintainers("example")).toEqual([
        { userId: OWNER.userId, handle: "owner", role: "owner" },
      ]);
    });
  });

  it("serves the bootstrap installer from the latest cpm package", async () => {
    await expect(service.readInstaller()).rejects.toMatchObject({ status: 404 });

    const cpm = (version: string): PackageVersionMetadata => ({ name: "cpm", version });
    await publish(
      pack(cpm("0.1.0"), { "bin/cpm.lua": "print('cpm')", "install.lua": "-- installer v0.1.0" }),
    );
    await publish(
      pack(cpm("0.2.0"), { "bin/cpm.lua": "print('cpm')", "install.lua": "-- installer v0.2.0" }),
    );
    expect(text(await service.readInstaller())).toBe("-- installer v0.2.0");
  });
});
