import { createHash } from "node:crypto";

/**
 * Computes the content digests recorded in a version's `dist`: an npm-style
 * `shasum` (SHA-1 hex) and a Subresource Integrity `integrity` value (sha512 SRI).
 * Runs on the Workers runtime via the `nodejs_compat` flag.
 */
export function computeDigests(data: Uint8Array) {
  return {
    shasum: createHash("sha1").update(data).digest("hex"),
    integrity: `sha512-${createHash("sha512").update(data).digest("base64")}`,
  };
}

/**
 * Hex SHA-256 of the derived bundle. The CC:Tweaked client verifies this in pure
 * Lua, where SHA-256 is the practical ceiling (the VM only has 32-bit bit ops,
 * so SHA-512 would be strictly slower for no gain) and hex comparison avoids a
 * base64 dependency.
 */
export function sha256Hex(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}
