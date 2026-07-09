import { createRoute, z } from "@hono/zod-openapi";

import { jsonFail, serverError, success } from "../../jsend.js";
import { packageSchema, packageVersionSchema, semverSchema } from "./schemas.js";

/**
 * OpenAPI route definitions for the package endpoints: paths, params, bodies,
 * and response shapes. Pure declaration - the handlers live in `endpoints.ts`.
 */

const nameParam = z
  .string()
  .min(1)
  .openapi({ param: { name: "name", in: "path" }, example: "example" });
const versionParam = semverSchema.openapi({ param: { name: "version", in: "path" } });

export const listPackagesRoute = createRoute({
  tags: ["Packages"],
  method: "get",
  path: "/packages",
  summary: "List packages",
  description: "Returns all CPM packages in the registry.",
  responses: {
    200: {
      content: {
        "application/json": { schema: success(z.object({ packages: z.array(packageSchema) })) },
      },
      description: "All packages",
    },
    500: serverError,
  },
});

export const getPackageRoute = createRoute({
  tags: ["Packages"],
  method: "get",
  path: "/packages/{name}",
  summary: "Get package",
  description: "Returns the CPM package entry for the given package name.",
  request: { params: z.object({ name: nameParam }) },
  responses: {
    200: {
      content: { "application/json": { schema: success(packageSchema) } },
      description: "The package",
    },
    404: jsonFail("Package not found"),
    500: serverError,
  },
});

export const getPackageVersionRoute = createRoute({
  tags: ["Packages"],
  method: "get",
  path: "/packages/{name}/{version}",
  summary: "Get package version",
  description: "Returns the specific version entry for the given package.",
  request: { params: z.object({ name: nameParam, version: versionParam }) },
  responses: {
    200: {
      content: { "application/json": { schema: success(packageVersionSchema) } },
      description: "The version",
    },
    400: jsonFail("Invalid version"),
    404: jsonFail("Package or version not found"),
    500: serverError,
  },
});

export const publishPackageRoute = createRoute({
  tags: ["Packages"],
  method: "post",
  path: "/packages",
  summary: "Publish package version",
  description:
    "Creates a package if missing, or adds a new version to an existing one. Published versions are immutable: re-publishing an existing version returns 409. Send metadata JSON as `meta` plus the tarball file as `tarball` in multipart/form-data.",
  request: {
    body: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: z.object({
            meta: z.string().openapi({
              description: "Package version metadata as a JSON string",
              example: '{"name":"example","version":"1.0.0"}',
            }),
            tarball: z.any().openapi({
              type: "string",
              format: "binary",
              description: "gzipped tarball bytes",
            }),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: success(packageSchema) } },
      description: "Published",
    },
    400: jsonFail("Invalid request"),
    409: jsonFail("Version already published"),
    500: serverError,
  },
});

export const downloadTarballRoute = createRoute({
  tags: ["Packages"],
  method: "get",
  path: "/packages/{name}/{version}/dist/tarball",
  summary: "Download tarball",
  description: "Returns the gzipped tarball bytes for a specific package version.",
  request: { params: z.object({ name: nameParam, version: versionParam }) },
  responses: {
    200: {
      content: {
        "application/gzip": {
          schema: z.string().openapi({ type: "string", format: "binary" }),
        },
      },
      description: "Tarball bytes",
    },
    400: jsonFail("Invalid version"),
    404: jsonFail("Not found"),
    500: serverError,
  },
});
