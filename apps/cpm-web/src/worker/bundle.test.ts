import { describe, expect, it } from "vitest";

import { type BundleManifest, findReadmePath, parseBundle, readReadme } from "@/worker/bundle";

/** Builds a bundle container the way the registry does (length-prefixed manifest + blob). */
function buildBundle(files: Record<string, string>): Uint8Array {
  const encoder = new TextEncoder();
  const blobs: Uint8Array[] = [];
  const manifestFiles = [];
  let offset = 0;
  for (const [path, content] of Object.entries(files)) {
    const data = encoder.encode(content);
    manifestFiles.push({ path, offset, length: data.byteLength });
    blobs.push(data);
    offset += data.byteLength;
  }
  const manifest: BundleManifest = { name: "example", version: "1.0.0", files: manifestFiles };
  const manifestBytes = encoder.encode(JSON.stringify(manifest));
  const prefix = encoder.encode(`${manifestBytes.byteLength}\n`);
  const out = new Uint8Array(prefix.byteLength + manifestBytes.byteLength + offset);
  out.set(prefix, 0);
  out.set(manifestBytes, prefix.byteLength);
  let pos = prefix.byteLength + manifestBytes.byteLength;
  for (const blob of blobs) {
    out.set(blob, pos);
    pos += blob.byteLength;
  }
  return out;
}

describe("parseBundle", () => {
  it("round-trips the manifest and blob offset", () => {
    const bundle = buildBundle({ "init.lua": "return {}", "README.md": "# hi" });
    const { manifest, blobStart } = parseBundle(bundle);
    expect(manifest.name).toBe("example");
    expect(manifest.files.map((f) => f.path)).toEqual(["init.lua", "README.md"]);
    const first = manifest.files[0]!;
    const text = new TextDecoder().decode(
      bundle.subarray(blobStart + first.offset, blobStart + first.offset + first.length),
    );
    expect(text).toBe("return {}");
  });

  it("rejects a bundle without a length line", () => {
    expect(() => parseBundle(new TextEncoder().encode("no newline here"))).toThrow(
      "manifest length line",
    );
  });

  it("rejects a manifest length pointing past the end", () => {
    expect(() => parseBundle(new TextEncoder().encode("9999\n{}"))).toThrow(
      "invalid manifest length",
    );
  });
});

describe("findReadmePath", () => {
  const manifest = (paths: string[]): BundleManifest => ({
    name: "example",
    version: "1.0.0",
    files: paths.map((path) => ({ path, offset: 0, length: 0 })),
  });

  it("finds a root README.md case-insensitively", () => {
    expect(findReadmePath(manifest(["init.lua", "ReadMe.MD"]))).toBe("ReadMe.MD");
  });

  it("prefers README.md over a bare README", () => {
    expect(findReadmePath(manifest(["README", "README.md"]))).toBe("README.md");
  });

  it("accepts a bare README", () => {
    expect(findReadmePath(manifest(["README", "init.lua"]))).toBe("README");
  });

  it("ignores nested readmes", () => {
    expect(findReadmePath(manifest(["docs/README.md", "init.lua"]))).toBeNull();
  });
});

describe("readReadme", () => {
  it("extracts the README text", () => {
    const bundle = buildBundle({ "init.lua": "return {}", "README.md": "# example\n\nhello" });
    expect(readReadme(bundle)).toBe("# example\n\nhello");
  });

  it("returns null when the package ships no README", () => {
    expect(readReadme(buildBundle({ "init.lua": "return {}" }))).toBeNull();
  });

  it("rejects a file entry pointing outside the blob", () => {
    // A hand-built bundle whose README entry claims more bytes than the blob has.
    const manifest = JSON.stringify({
      name: "example",
      version: "1.0.0",
      files: [{ path: "README.md", offset: 0, length: 9999 }],
    });
    const bundle = new TextEncoder().encode(`${manifest.length}\n${manifest}hi`);
    expect(() => readReadme(bundle)).toThrow("outside the blob");
  });
});
