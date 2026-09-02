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
  // Dots are reserved: Lua's require maps dots to directory separators, so a
  // dotted name cannot be loaded from the client's flat store today. Allowing
  // them later must land together with namespaced install paths.
  .regex(/^[a-zA-Z0-9_-]+$/)
  .openapi({ example: "example" });

const authorSchema = z.string().optional().openapi({ example: "chungindustries" });

// Capped so the full package index stays cheap to serve and render; the limit
// is far above what a one-paragraph summary needs.
const descriptionSchema = z.string().min(1).max(1024).optional().openapi({
  example: "Example utilities for CC:Tweaked computers",
  description: "Short user-facing summary of what the package does",
});

const createdAtSchema = z.iso.datetime().openapi({
  example: "2026-01-15T12:00:00.000Z",
  description: "Publish timestamp, ISO 8601 UTC",
});

// Existence of the referenced file inside the tarball is checked at publish.
const startupSchema = z.string().min(1).optional().openapi({
  example: "startup.lua",
  description:
    "Path, relative to the package root, of a Lua file the client runs at computer startup",
});

const dependenciesSchema = z
  .record(packageNameSchema, semverRangeSchema)
  .optional()
  .openapi({
    example: { "cc-http": "^1.2.0" },
    description: "Dependency map of package name to semver range",
  });

const tarballDistSchema = z
  .strictObject({
    url: z
      .string()
      .openapi({ example: "/packages/example/1.0.0/dist/tarball", description: "Tarball path" }),
    shasum: z
      .string()
      .regex(/^[a-f0-9]{40}$/)
      .openapi({
        example: "a94a8fe5ccb19ba61c4c0873d391e987982fbbd3",
        description: "SHA-1 hex digest of the tarball",
      }),
    integrity: z
      .string()
      .regex(/^sha512-[A-Za-z0-9+/]+={0,2}$/)
      .openapi({
        example:
          "sha512-z4PhNX7vuL3xVChQ1m2AB9Yg5AULVxXcg/SpIdNs6c5H0NE8XYXysP+DGNKHfuwvY7kxvUdBeoGlODJ6+SfaPg==",
        description: "Subresource Integrity (SRI) sha512 digest of the tarball",
      }),
  })
  .openapi({ description: "The publish artifact: a gzipped tar of the package files" });

const bundleDistSchema = z
  .strictObject({
    url: z.string().openapi({
      example: "/packages/example/1.0.0/dist/bundle",
      description: "Bundle path: the artifact the in-game cpm client downloads",
    }),
    sha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .openapi({
        example: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
        description: "Hex SHA-256 digest of the bundle bytes",
      }),
    size: z
      .number()
      .int()
      .nonnegative()
      .openapi({ example: 4096, description: "Bundle size in bytes (before wire compression)" }),
  })
  .openapi({
    description:
      "The derived install artifact: a length-prefixed JSON manifest plus raw file bytes",
  });

const distSchema = z
  .strictObject({ tarball: tarballDistSchema, bundle: bundleDistSchema })
  .openapi({ description: "Distribution artifacts, one entry per artifact kind" });

const exampleDist: z.infer<typeof distSchema> = {
  tarball: {
    url: "/packages/example/1.0.0/dist/tarball",
    shasum: "a94a8fe5ccb19ba61c4c0873d391e987982fbbd3",
    integrity:
      "sha512-z4PhNX7vuL3xVChQ1m2AB9Yg5AULVxXcg/SpIdNs6c5H0NE8XYXysP+DGNKHfuwvY7kxvUdBeoGlODJ6+SfaPg==",
  },
  bundle: {
    url: "/packages/example/1.0.0/dist/bundle",
    sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    size: 4096,
  },
};

/** A dependency spec accepted by `/resolve`: a semver range, exact version, or dist-tag. */
const dependencySpecSchema = z
  .string()
  .min(1)
  .openapi({ example: "^1.2.0", description: "Semver range, exact version, or dist-tag" });

export const resolveRequestSchema = z
  .strictObject({
    dependencies: z
      .record(packageNameSchema, dependencySpecSchema)
      .refine((deps) => Object.keys(deps).length > 0, "At least one dependency is required")
      .openapi({ example: { example: "^1.2.0", "cc-http": "latest" } }),
  })
  .openapi("ResolveRequest");
export type ResolveRequest = z.infer<typeof resolveRequestSchema>;

// Named in the OpenAPI document so publishing tools can generate the cpm.json
// type straight from the spec instead of re-declaring it by hand.
export const packageVersionMetadataSchema = z
  .strictObject({
    name: packageNameSchema,
    version: semverSchema,
    description: descriptionSchema,
    author: authorSchema,
    dependencies: dependenciesSchema,
    startup: startupSchema,
  })
  .openapi("PackageVersionMetadata", {
    description:
      "The package manifest: the `cpm.json` at the tarball root, which the registry treats as the metadata source of truth at publish",
  });
export type PackageVersionMetadata = z.infer<typeof packageVersionMetadataSchema>;

// `createdAt` is assigned by the store at publish, so it is part of the
// response contract but not of the manifest metadata above.
export const packageVersionSchema = packageVersionMetadataSchema
  .extend({ dist: distSchema, createdAt: createdAtSchema })
  .openapi("PackageVersion", {
    description:
      "A published version: the manifest metadata plus its distribution artifacts and publish timestamp",
    example: {
      name: "example",
      description: "Example utilities for CC:Tweaked computers",
      author: "chungindustries",
      version: "1.0.0",
      dependencies: { "cc-http": "^1.2.0" },
      dist: exampleDist,
      createdAt: "2026-01-15T12:00:00.000Z",
    },
  });
export type PackageVersion = z.infer<typeof packageVersionSchema>;

export const distTagsSchema = z
  .object({ latest: semverSchema })
  .catchall(semverSchema)
  .openapi("DistTags", {
    example: { latest: "1.0.0" },
    description: "Distribution tags mapping tag names to versions",
  });
export type DistTags = z.infer<typeof distTagsSchema>;

export const packageSchema = z
  .strictObject({
    name: packageNameSchema,
    author: authorSchema,
    createdAt: createdAtSchema.openapi({ description: "First-publish timestamp, ISO 8601 UTC" }),
    "dist-tags": distTagsSchema,
    versions: z.record(semverSchema, packageVersionSchema).openapi({
      example: {
        "1.0.0": {
          name: "example",
          description: "Example utilities for CC:Tweaked computers",
          author: "chungindustries",
          version: "1.0.0",
          dependencies: { "cc-http": "^1.2.0" },
          dist: exampleDist,
          createdAt: "2026-01-15T12:00:00.000Z",
        },
      },
    }),
  })
  .openapi("Package");
export type Package = z.infer<typeof packageSchema>;
