import { type ParsedTarFileItem, parseTar } from "nanotar";

import { BadRequestError } from "@/errors";

/**
 * The "bundle" is the artifact the in-game cpm client downloads: a length-prefixed
 * JSON manifest followed by the raw concatenated file bytes.
 *
 *   <manifest byte length, ASCII decimal>\n<minified manifest JSON><blob>
 *
 * It is derived once at publish from the uploaded tarball so the CC:Tweaked client
 * never parses tar or inflates gzip in Lua (both are impractically slow there);
 * compression happens on the wire only. Offsets in the manifest are relative to
 * the first blob byte. See docs/cpm-client-design.md section 2.
 */

/**
 * Hard cap on a package's extracted size. CC computers default to a 1 MB disk,
 * so anything larger could never be installed anyway, and the cap also bounds
 * the gunzip of an untrusted upload (decompression bombs).
 */
export const MAX_EXTRACTED_BYTES = 512 * 1024;

/**
 * Entry kinds that have no representation on a CC computer's filesystem.
 * Directory entries and pax/GNU metadata entries are fine to skip silently
 * (paths imply directories, and nanotar folds metadata into its file entries),
 * but a link or device entry means the package genuinely loses content.
 */
const UNSUPPORTED_ENTRY_TYPES = new Set([
  "hardLink",
  "symbolicLink",
  "characterDevice",
  "blockDevice",
  "fifo",
]);

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

/** Gunzips `data`, aborting as soon as the output would exceed `limit` bytes. */
export async function gunzipLimited(data: Uint8Array, limit: number): Promise<Uint8Array> {
  const reader = new Blob([data as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"))
    .getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new BadRequestError(`Tarball exceeds the ${limit} byte extracted size limit`);
      }
      chunks.push(value);
    }
  } catch (err) {
    if (err instanceof BadRequestError) throw err;
    throw new BadRequestError("Tarball is not valid gzip data");
  }
  return concat(chunks, total);
}

/**
 * Validates a tar entry path for installation under a package directory: relative,
 * forward slashes, no empty, `.`, or `..` segments. A leading `./` (as produced by
 * some tar tools) is stripped; anything else is rejected rather than normalised so
 * the stored bundle never contains a path the client has to second-guess.
 */
export function normalizeBundlePath(raw: string): string {
  const path = raw.startsWith("./") ? raw.slice(2) : raw;
  if (path.length === 0) throw new BadRequestError("Tarball contains an entry with an empty path");
  if (path.includes("\\") || path.startsWith("/")) {
    throw new BadRequestError(
      `Tarball entry "${raw}" must be a relative path with forward slashes`,
    );
  }
  for (const segment of path.split("/")) {
    if (segment === "" || segment === "." || segment === "..") {
      throw new BadRequestError(`Tarball entry "${raw}" contains an invalid path segment`);
    }
  }
  return path;
}

/**
 * Parses an uncompressed tar (already size-checked) into its validated file map.
 * The service reads `cpm.json` out of this map before the container is built.
 */
export function collectPackageFiles(tar: Uint8Array): Map<string, Uint8Array> {
  let entries: ParsedTarFileItem[];
  try {
    entries = parseTar(tar) as ParsedTarFileItem[];
  } catch {
    throw new BadRequestError("Tarball is not a valid tar archive");
  }

  const files = new Map<string, Uint8Array>();
  for (const entry of entries) {
    // Links and special files cannot exist on a CC filesystem; a package that
    // ships one is broken, so fail the publish loudly instead of silently
    // producing a bundle with the entry missing.
    if (entry.type !== undefined && UNSUPPORTED_ENTRY_TYPES.has(entry.type)) {
      throw new BadRequestError(
        `Tarball entry "${entry.name}" is a ${entry.type}; only regular files and directories are supported`,
      );
    }
    // "\0" typeflags (pre-ustar archives) parse as an undefined type; treat those
    // as regular files unless the name marks a directory.
    const isFile =
      entry.type === "file" ||
      entry.type === "contiguousFile" ||
      (entry.type === undefined && !entry.name.endsWith("/"));
    if (!isFile) continue;
    const path = normalizeBundlePath(entry.name);
    if (files.has(path)) throw new BadRequestError(`Tarball contains "${path}" more than once`);
    files.set(path, entry.data ?? new Uint8Array());
  }
  if (files.size === 0) throw new BadRequestError("Tarball contains no files");
  return files;
}

/** Builds the bundle container from a validated file map. */
export function buildBundle(
  meta: { name: string; version: string },
  files: Map<string, Uint8Array>,
): Uint8Array {
  // Sorted paths keep the bundle bytes (and so the digest) deterministic for a
  // given set of files regardless of tar entry order.
  const sorted = [...files.keys()].sort();
  const manifestFiles: BundleFile[] = [];
  const blobs: Uint8Array[] = [];
  let offset = 0;
  for (const path of sorted) {
    const data = files.get(path)!;
    manifestFiles.push({ path, offset, length: data.byteLength });
    blobs.push(data);
    offset += data.byteLength;
  }

  const manifest: BundleManifest = { name: meta.name, version: meta.version, files: manifestFiles };
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
  const prefix = new TextEncoder().encode(`${manifestBytes.byteLength}\n`);
  return concat(
    [prefix, manifestBytes, ...blobs],
    prefix.byteLength + manifestBytes.byteLength + offset,
  );
}

/** Parses a stored bundle back into its manifest plus the blob start offset. */
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

/** Extracts one file's bytes from a stored bundle, or null if the path is absent. */
export function readBundleFile(bundle: Uint8Array, path: string): Uint8Array | null {
  const { manifest, blobStart } = parseBundle(bundle);
  const file = manifest.files.find((f) => f.path === path);
  if (!file) return null;
  const start = blobStart + file.offset;
  return bundle.slice(start, start + file.length);
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let pos = 0;
  for (const chunk of chunks) {
    out.set(chunk, pos);
    pos += chunk.byteLength;
  }
  return out;
}
