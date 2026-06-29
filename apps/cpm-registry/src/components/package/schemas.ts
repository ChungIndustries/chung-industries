import { z } from "zod";

export const semverSchema = z
  .string()
  .regex(/^[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.-]+)?$/)
  .example("1.0.0")
  .describe("Semantic version string");
export type Semver = z.infer<typeof semverSchema>;

const semverRangeSchema = z
  .string()
  .regex(/^[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.-]+)?$/)
  .example("^1.2.0")
  .describe("Semantic version range string");

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

const distSchema = z.strictObject({ tarball: tarballSchema }).describe("Distribution info");

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
    },
  });
export type PackageVersion = z.infer<typeof packageVersionSchema>;

export const packageSchema = z.strictObject({
  name: packageNameSchema,
  author: authorSchema,
  versions: z.record(semverSchema, packageVersionSchema).example({
    "1.0.0": {
      name: "example",
      author: "chungindustries",
      version: "1.0.0",
      dependencies: { "cc-http": "^1.2.0" },
      dist: {
        tarball: "https://registry.cpm.chungindustries.com/packages/example/1.0.0/dist/tarball",
      },
    },
  }),
});
export type Package = z.infer<typeof packageSchema>;
