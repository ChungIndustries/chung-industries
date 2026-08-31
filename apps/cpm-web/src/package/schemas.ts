import { z } from "zod";

/**
 * Consumer-side mirror of the registry's response schemas
 * (apps/cpm-registry/src/components/package/schemas.ts): the registry owns
 * the contract, and the site checks at its server-function boundary that the
 * responses still carry the fields it renders. Only those fields are
 * declared.
 */

export const tarballDistSchema = z.object({
  url: z.string(),
  shasum: z.string(),
  integrity: z.string(),
});

export const bundleDistSchema = z.object({
  url: z.string(),
  sha256: z.string(),
  size: z.number(),
});

export const packageVersionSchema = z.object({
  name: z.string(),
  version: z.string(),
  author: z.string().optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  startup: z.string().optional(),
  dist: z.object({ tarball: tarballDistSchema, bundle: bundleDistSchema }),
});

export const distTagsSchema = z.object({ latest: z.string() }).catchall(z.string());

export const packageSchema = z.object({
  name: z.string(),
  author: z.string().optional(),
  "dist-tags": distTagsSchema,
  versions: z.record(z.string(), packageVersionSchema),
});

export type TarballDist = z.infer<typeof tarballDistSchema>;
export type BundleDist = z.infer<typeof bundleDistSchema>;
export type PackageVersion = z.infer<typeof packageVersionSchema>;
export type DistTags = z.infer<typeof distTagsSchema>;
export type Package = z.infer<typeof packageSchema>;
