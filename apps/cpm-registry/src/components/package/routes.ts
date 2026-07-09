import { type OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import type { Bindings } from "@/bindings";
import {
  packageSchema,
  packageVersionMetadataSchema,
  packageVersionSchema,
  semverSchema,
  type PackageVersionMetadata,
} from "@/components/package/schemas";
import { PackageService } from "@/components/package/service";
import { D1RegistryStore } from "@/components/package/store/d1";
import { R2TarballStore } from "@/components/package/store/r2";
import { BadRequestError } from "@/errors";
import { jsonFail, jsonSuccess, serverError } from "@/jsend";

type App = OpenAPIHono<{ Bindings: Bindings }>;

function serviceFor(env: Bindings): PackageService {
  return new PackageService(new D1RegistryStore(env.DB), new R2TarballStore(env.BUCKET));
}

/** Validates the multipart publish form into metadata plus raw tarball bytes. */
async function parsePublishForm(form: {
  meta: string;
  tarball: unknown;
}): Promise<{ meta: PackageVersionMetadata; data: Uint8Array }> {
  let json: unknown;
  try {
    json = JSON.parse(form.meta);
  } catch {
    throw new BadRequestError("`meta` must be valid JSON");
  }
  const meta = packageVersionMetadataSchema.parse(json);

  if (!(form.tarball instanceof File)) {
    throw new BadRequestError("Tarball file is missing");
  }
  return { meta, data: new Uint8Array(await form.tarball.arrayBuffer()) };
}

// Immutable versions can be cached forever. Repeat downloads are served from the
// Cloudflare edge cache, so the Worker and R2 are only touched on a cache miss.
const CACHE_CONTROL = "public, max-age=31536000, immutable";
function edgeCache(): Cache | undefined {
  return (globalThis as { caches?: CacheStorage }).caches?.default;
}

const nameParam = z
  .string()
  .min(1)
  .openapi({ param: { name: "name", in: "path" }, example: "example" });
const versionParam = semverSchema.openapi({ param: { name: "version", in: "path" } });

export function registerPackageRoutes(app: App): void {
  app.openapi(
    createRoute({
      tags: ["Packages"],
      method: "get",
      path: "/packages",
      summary: "List packages",
      description: "Returns all CPM packages in the registry.",
      responses: {
        200: jsonSuccess(z.object({ packages: z.array(packageSchema) }), "All packages"),
        500: serverError,
      },
    }),
    async (c) =>
      c.json(
        { status: "success" as const, data: { packages: await serviceFor(c.env).list() } },
        200,
      ),
  );

  app.openapi(
    createRoute({
      tags: ["Packages"],
      method: "get",
      path: "/packages/{name}",
      summary: "Get package",
      description: "Returns the CPM package entry for the given package name.",
      request: { params: z.object({ name: nameParam }) },
      responses: {
        200: jsonSuccess(packageSchema, "The package"),
        404: jsonFail("Package not found"),
        500: serverError,
      },
    }),
    async (c) =>
      c.json(
        {
          status: "success" as const,
          data: await serviceFor(c.env).get(c.req.valid("param").name),
        },
        200,
      ),
  );

  app.openapi(
    createRoute({
      tags: ["Packages"],
      method: "get",
      path: "/packages/{name}/{version}",
      summary: "Get package version",
      description: "Returns the specific version entry for the given package.",
      request: { params: z.object({ name: nameParam, version: versionParam }) },
      responses: {
        200: jsonSuccess(packageVersionSchema, "The version"),
        400: jsonFail("Invalid version"),
        404: jsonFail("Package or version not found"),
        500: serverError,
      },
    }),
    async (c) => {
      const { name, version } = c.req.valid("param");
      return c.json(
        { status: "success" as const, data: await serviceFor(c.env).getVersion(name, version) },
        200,
      );
    },
  );

  app.openapi(
    createRoute({
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
        201: jsonSuccess(packageSchema, "Published"),
        400: jsonFail("Invalid request"),
        409: jsonFail("Version already published"),
        500: serverError,
      },
    }),
    async (c) => {
      const { meta, data } = await parsePublishForm(c.req.valid("form"));
      const pkg = await serviceFor(c.env).publish(meta, data);
      return c.json({ status: "success" as const, data: pkg }, 201);
    },
  );

  app.openapi(
    createRoute({
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
    }),
    async (c) => {
      const { name, version } = c.req.valid("param");
      const cache = edgeCache();
      const cacheKey = new Request(c.req.url);
      const hit = cache ? await cache.match(cacheKey) : undefined;
      const data = hit
        ? new Uint8Array(await hit.arrayBuffer())
        : await serviceFor(c.env).readTarball(name, version);
      // These bytes are always backed by a plain ArrayBuffer (from arrayBuffer()
      // or an in-memory copy), which is what c.body's typed overload expects.
      const res = c.body(data as Uint8Array<ArrayBuffer>, 200, {
        "Content-Type": "application/gzip",
        "Cache-Control": CACHE_CONTROL,
      });
      if (cache && !hit) c.executionCtx.waitUntil(cache.put(cacheKey, res.clone()));
      return res;
    },
  );
}
