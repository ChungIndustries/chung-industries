import semver from "semver";
import { z } from "zod";

// Validity is delegated entirely to the `semver` package, consistent with
// `semverRangeSchema` below. We intentionally don't keep a regex: it would be a
// second, stricter source of truth (it rejects valid build metadata like
// `1.0.0+build`) whose only benefit was a docs `pattern`.
//
// `.refine()` must come last: express-zod-api augments the base schema with
// `.example()`, and that augmentation does not survive the refine wrapper.
export const semverSchema = z
  .string()
  .example("1.0.0")
  .describe("Semantic version string")
  .refine((value) => semver.valid(value) !== null, "Invalid semantic version");
export type Semver = z.infer<typeof semverSchema>;

const semverRangeSchema = z
  .string()
  .example("^1.2.0")
  .describe("Semantic version range string")
  .refine((value) => semver.validRange(value) !== null, "Invalid semantic version range");

const packageNameSchema = z
  .string()
  .regex(/^[a-z0-9._-]+$/i)
  .example("example");

const authorSchema = z.string().optional().example("chungindustries");

const dependenciesSchema = z
  .record(packageNameSchema.describe("Dependency name"), semverRangeSchema)
  .optional()
  .example({ "cc-http": "^1.2.0" })
  .describe("Dependency map of package name to semver range");

const tarballSchema = z
  .string()
  .example("/packages/example/1.0.0/dist/tarball")
  .describe("Tarball path");

const shasumSchema = z
  .string()
  .regex(/^[a-f0-9]{40}$/)
  .example("a94a8fe5ccb19ba61c4c0873d391e987982fbbd3")
  .describe("SHA-1 hex digest of the tarball (npm-compatible)");

const integritySchema = z
  .string()
  .regex(/^sha512-[A-Za-z0-9+/]+={0,2}$/)
  .example(
    "sha512-z4PhNX7vuL3xVChQ1m2AB9Yg5AULVxXcg/SpIdNs6c5H0NE8XYXysP+DGNKHfuwvY7kxvUdBeoGlODJ6+SfaPg==",
  )
  .describe("Subresource Integrity (SRI) sha512 digest of the tarball");

const distSchema = z
  .strictObject({ tarball: tarballSchema, shasum: shasumSchema, integrity: integritySchema })
  .describe("Distribution info");

export const packageVersionMetadataSchema = z.strictObject({
  name: packageNameSchema,
  version: semverSchema,
  author: authorSchema,
  dependencies: dependenciesSchema,
});
export type PackageVersionMetadata = z.infer<typeof packageVersionMetadataSchema>;

export const packageVersionSchema = packageVersionMetadataSchema
  .extend({
    dist: distSchema,
  })
  .example({
    name: "example",
    author: "chungindustries",
    version: "1.0.0",
    dependencies: { "cc-http": "^1.2.0" },
    dist: {
      tarball: "https://registry.cpm.chungindustries.com/packages/example/1.0.0/dist/tarball",
      shasum: "a94a8fe5ccb19ba61c4c0873d391e987982fbbd3",
      integrity:
        "sha512-z4PhNX7vuL3xVChQ1m2AB9Yg5AULVxXcg/SpIdNs6c5H0NE8XYXysP+DGNKHfuwvY7kxvUdBeoGlODJ6+SfaPg==",
    },
  });
export type PackageVersion = z.infer<typeof packageVersionSchema>;

export const distTagsSchema = z
  .object({ latest: semverSchema })
  .catchall(semverSchema)
  .example({ latest: "1.0.0" })
  .describe("Distribution tags mapping tag names to versions (npm-compatible)");
export type DistTags = z.infer<typeof distTagsSchema>;

export const packageSchema = z.strictObject({
  name: packageNameSchema,
  author: authorSchema,
  "dist-tags": distTagsSchema,
  versions: z.record(semverSchema, packageVersionSchema).example({
    "1.0.0": {
      name: "example",
      author: "chungindustries",
      version: "1.0.0",
      dependencies: { "cc-http": "^1.2.0" },
      dist: {
        tarball: "https://registry.cpm.chungindustries.com/packages/example/1.0.0/dist/tarball",
        shasum: "a94a8fe5ccb19ba61c4c0873d391e987982fbbd3",
        integrity:
          "sha512-z4PhNX7vuL3xVChQ1m2AB9Yg5AULVxXcg/SpIdNs6c5H0NE8XYXysP+DGNKHfuwvY7kxvUdBeoGlODJ6+SfaPg==",
      },
    },
  }),
});
export type Package = z.infer<typeof packageSchema>;
