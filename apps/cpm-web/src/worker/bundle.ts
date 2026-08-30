/**
 * Read-side parser for the cpm bundle container, used to pull a package's
 * README out of its published artifact (the registry stores no separate README).
 *
 * Container format (see docs/cpm-client-design.md section 2, and the write side
 * in apps/cpm-registry/src/components/package/bundle.ts):
 *
 *   <manifest byte length, ASCII decimal>\n<minified manifest JSON><blob>
 *
 * Offsets in the manifest are relative to the first blob byte.
 */

export interface BundleFile {
  path: string;
  offset: number;
  length: number;
}

export interface BundleManifest {
  name: string;
  version: string;
  files: BundleFile[];
}

export function parseBundle(bundle: Uint8Array): { manifest: BundleManifest; blobStart: number } {
  const newline = bundle.indexOf(0x0a);
  if (newline === -1) throw new Error("Bundle is missing its manifest length line");
  const length = Number.parseInt(new TextDecoder().decode(bundle.subarray(0, newline)), 10);
  const manifestStart = newline + 1;
  if (!Number.isInteger(length) || manifestStart + length > bundle.byteLength) {
    throw new Error("Bundle has an invalid manifest length");
  }
  const manifest = JSON.parse(
    new TextDecoder().decode(bundle.subarray(manifestStart, manifestStart + length)),
  ) as BundleManifest;
  return { manifest, blobStart: manifestStart + length };
}

/**
 * The path of the package's README, or null if it ships none. Only root-level
 * files count (a nested docs/README.md is not the package README), matched
 * case-insensitively with `.md` preferred over an extensionless README.
 */
export function findReadmePath(manifest: BundleManifest): string | null {
  const roots = manifest.files.filter((file) => !file.path.includes("/"));
  const md = roots.find((file) => file.path.toLowerCase() === "readme.md");
  const bare = roots.find((file) => file.path.toLowerCase() === "readme");
  return (md ?? bare)?.path ?? null;
}

/** Extracts the README text from a bundle, or null if the package ships none. */
export function readReadme(bundle: Uint8Array): string | null {
  const { manifest, blobStart } = parseBundle(bundle);
  const path = findReadmePath(manifest);
  if (path === null) return null;
  const file = manifest.files.find((f) => f.path === path)!;
  const start = blobStart + file.offset;
  if (start + file.length > bundle.byteLength) {
    throw new Error(`Bundle file "${path}" points outside the blob`);
  }
  return new TextDecoder().decode(bundle.subarray(start, start + file.length));
}
