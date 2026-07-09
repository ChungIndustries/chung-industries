import { z } from "@hono/zod-openapi";
import semver from "semver";

// Validity is delegated entirely to the `semver` package, consistent with
// `semverRangeSchema` below. We intentionally don't keep a regex: it would be a
// second, stricter source of truth (it rejects valid build metadata like
// `1.0.0+build`). `.openapi()` comes last so its metadata sits on the outermost
// (refined) schema.
export const semverSchema = z
  .string()
  .refine((value) => semver.valid(value) !== null, "Invalid semantic version")
  .openapi({ example: "1.0.0", description: "Semantic version string" });
export type Semver = z.infer<typeof semverSchema>;

const semverRangeSchema = z
  .string()
  .refine((value) => semver.validRange(value) !== null, "Invalid semantic version range")
  .openapi({ example: "^1.2.0", description: "Semantic version range string" });

const packageNameSchema = z
  .string()
  // Explicit character class rather than the `i` flag: a case-insensitive regex
  // serializes into the OpenAPI `pattern` with a stray trailing `/i`.
  .regex(/^[a-zA-Z0-9._-]+$/)
  .openapi({ example: "example" });

const authorSchema = z.string().optional().openapi({ example: "chungindustries" });

const dependenciesSchema = z
  .record(packageNameSchema, semverRangeSchema)
  .optional()
  .openapi({
    example: { "cc-http": "^1.2.0" },
    description: "Dependency map of package name to semver range",
  });

const tarballSchema = z
  .string()
  .openapi({ example: "/packages/example/1.0.0/dist/tarball", description: "Tarball path" });

const shasumSchema = z
  .string()
  .regex(/^[a-f0-9]{40}$/)
  .openapi({
    example: "a94a8fe5ccb19ba61c4c0873d391e987982fbbd3",
    description: "SHA-1 hex digest of the tarball (npm-compatible)",
  });

const integritySchema = z
  .string()
  .regex(/^sha512-[A-Za-z0-9+/]+={0,2}$/)
  .openapi({
    example:
      "sha512-z4PhNX7vuL3xVChQ1m2AB9Yg5AULVxXcg/SpIdNs6c5H0NE8XYXysP+DGNKHfuwvY7kxvUdBeoGlODJ6+SfaPg==",
    description: "Subresource Integrity (SRI) sha512 digest of the tarball",
  });

const distSchema = z
  .strictObject({ tarball: tarballSchema, shasum: shasumSchema, integrity: integritySchema })
  .openapi({ description: "Distribution info" });

export const packageVersionMetadataSchema = z.strictObject({
  name: packageNameSchema,
  version: semverSchema,
  author: authorSchema,
  dependencies: dependenciesSchema,
});
export type PackageVersionMetadata = z.infer<typeof packageVersionMetadataSchema>;

export const packageVersionSchema = packageVersionMetadataSchema
  .extend({ dist: distSchema })
  .openapi("PackageVersion", {
    example: {
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
  });
export type PackageVersion = z.infer<typeof packageVersionSchema>;

export const distTagsSchema = z
  .object({ latest: semverSchema })
  .catchall(semverSchema)
  .openapi("DistTags", {
    example: { latest: "1.0.0" },
    description: "Distribution tags mapping tag names to versions (npm-compatible)",
  });
export type DistTags = z.infer<typeof distTagsSchema>;

export const packageSchema = z
  .strictObject({
    name: packageNameSchema,
    author: authorSchema,
    "dist-tags": distTagsSchema,
    versions: z.record(semverSchema, packageVersionSchema).openapi({
      example: {
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
      },
    }),
  })
  .openapi("Package");
export type Package = z.infer<typeof packageSchema>;
