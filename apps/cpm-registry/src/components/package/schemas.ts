import { z } from "@hono/zod-openapi";
import semver from "semver";

import { HANDLE_PATTERN } from "@/components/auth/handle";

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

export const packageVersionMetadataSchema = z.strictObject({
  name: packageNameSchema,
  version: semverSchema,
  description: descriptionSchema,
  author: authorSchema,
  dependencies: dependenciesSchema,
  startup: startupSchema,
});
export type PackageVersionMetadata = z.infer<typeof packageVersionMetadataSchema>;

// `createdAt` is assigned by the store at publish, so it is part of the
// response contract but not of the manifest metadata above.
export const packageVersionSchema = packageVersionMetadataSchema
  .extend({ dist: distSchema, createdAt: createdAtSchema })
  .openapi("PackageVersion", {
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

export const handleSchema = z.string().regex(HANDLE_PATTERN).openapi({
  example: "octocat",
  description:
    "The account's handle, which is its GitHub login from when it signed up. Case-insensitive.",
});

export const maintainerSchema = z
  .strictObject({
    userId: z.string().openapi({
      example: "kq3vw7s5q1m9e8x2c4n6b0z1a7y5r3t9",
      description: "Stable account id",
    }),
    handle: handleSchema,
    role: z.enum(["owner", "maintainer"]).openapi({
      description:
        "Every package has exactly one `owner`, the only one who can add or remove maintainers",
    }),
  })
  .openapi("Maintainer", {
    example: { userId: "kq3vw7s5q1m9e8x2c4n6b0z1a7y5r3t9", handle: "octocat", role: "owner" },
  });
export type MaintainerEntry = z.infer<typeof maintainerSchema>;

export const maintainersSchema = z
  .strictObject({
    maintainers: z
      .array(maintainerSchema)
      .openapi({ description: "The owner first, then everyone else in the order they were added" }),
  })
  .openapi("Maintainers");

/** Default and ceiling for `GET /search` page sizes. */
export const SEARCH_DEFAULT_LIMIT = 20;
export const SEARCH_MAX_LIMIT = 100;

const queryParam = (name: string) => ({ param: { name, in: "query" as const } });

export const searchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .default("")
    .openapi({
      ...queryParam("q"),
      example: "http",
      description:
        "Text to match against package names, authors, and descriptions. Empty or omitted matches every package",
    }),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(SEARCH_MAX_LIMIT)
    .default(SEARCH_DEFAULT_LIMIT)
    .openapi({
      ...queryParam("limit"),
      example: SEARCH_DEFAULT_LIMIT,
      description: `Page size, at most ${SEARCH_MAX_LIMIT}`,
    }),
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .default(0)
    .openapi({
      ...queryParam("offset"),
      example: 0,
      description: "Number of matches to skip",
    }),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

/**
 * One package as it appears in search results: what an index row needs, taken
 * from the package and its `latest` version, without the full version map.
 */
export const packageSummarySchema = z
  .strictObject({
    name: packageNameSchema,
    author: authorSchema,
    description: descriptionSchema,
    version: semverSchema.openapi({ description: "The version `dist-tags.latest` points at" }),
    versionCount: z
      .number()
      .int()
      .positive()
      .openapi({ example: 3, description: "Number of published versions" }),
    publishedAt: createdAtSchema.openapi({
      description: "Publish timestamp of the latest version, ISO 8601 UTC",
    }),
  })
  .openapi("PackageSummary", {
    example: {
      name: "example",
      author: "chungindustries",
      description: "Example utilities for CC:Tweaked computers",
      version: "1.0.0",
      versionCount: 3,
      publishedAt: "2026-01-15T12:00:00.000Z",
    },
  });
export type PackageSummary = z.infer<typeof packageSummarySchema>;

export const searchResultsSchema = z
  .strictObject({
    results: z
      .array(packageSummarySchema)
      .openapi({ description: "The requested page of matches" }),
    total: z
      .number()
      .int()
      .nonnegative()
      .openapi({ example: 1, description: "Number of matches across all pages" }),
  })
  .openapi("SearchResults");
export type SearchResults = z.infer<typeof searchResultsSchema>;
