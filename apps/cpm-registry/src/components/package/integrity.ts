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
