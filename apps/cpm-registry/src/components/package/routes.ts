import { type OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";

import {
  packageSchema,
  packageVersionMetadataSchema,
  packageVersionSchema,
  resolveRequestSchema,
  semverSchema,
  type PackageVersionMetadata,
} from "@/components/package/schemas";
import { MAX_TARBALL_BYTES, PackageService } from "@/components/package/service";
import { D1RegistryStore } from "@/components/package/store/d1";
import { R2BlobStore } from "@/components/package/store/r2";
import { BadRequestError, PayloadTooLargeError } from "@/errors";
import { jsonFail, jsonSuccess, serverError } from "@/jsend";

type App = OpenAPIHono<{ Bindings: Env }>;
type Ctx = Context<{ Bindings: Env }>;

function serviceFor(env: Env): PackageService {
  return new PackageService(new D1RegistryStore(env.DB), new R2BlobStore(env.BUCKET));
}

/** Validates the multipart publish form into raw tarball bytes plus the optional meta cross-check. */
async function parsePublishForm(form: {
  meta?: string;
  tarball: unknown;
}): Promise<{ meta: PackageVersionMetadata | undefined; data: Uint8Array }> {
  let meta: PackageVersionMetadata | undefined;
  if (form.meta !== undefined) {
    let json: unknown;
    try {
      json = JSON.parse(form.meta);
    } catch {
      throw new BadRequestError("`meta` must be valid JSON");
    }
    meta = packageVersionMetadataSchema.parse(json);
  }

  if (!(form.tarball instanceof File)) {
    throw new BadRequestError("Tarball file is missing");
  }
  // Short-circuit on the declared size so an oversized upload is not copied into
  // a Uint8Array just to be rejected. The service re-checks the actual bytes.
  if (form.tarball.size > MAX_TARBALL_BYTES) {
    throw new PayloadTooLargeError(
      `Tarball exceeds the maximum size of ${MAX_TARBALL_BYTES} bytes`,
    );
  }
  return { meta, data: new Uint8Array(await form.tarball.arrayBuffer()) };
}

// Immutable versions can be cached forever. Repeat downloads are served from the
// Cloudflare edge cache, so the Worker and R2 are only touched on a cache miss.
const IMMUTABLE = "public, max-age=31536000, immutable";
// The installer follows cpm's `latest` tag, so it is only briefly cacheable.
const INSTALLER_CACHE = "public, max-age=300";

function edgeCache(): Cache | undefined {
  return (globalThis as { caches?: CacheStorage }).caches?.default;
}

/**
 * Serves immutable artifact bytes through the edge cache. The cached copy is
 * always the plain bytes with no transfer encoding; `headers` are applied to the
 * outgoing response only, so the cache never has to reason about encodings.
 */
async function serveImmutable(
  c: Ctx,
  read: () => Promise<Uint8Array>,
  headers: Record<string, string>,
): Promise<Response> {
  const cache = edgeCache();
  const cacheKey = new Request(c.req.url);
  const hit = cache ? await cache.match(cacheKey) : undefined;
  const data = hit ? new Uint8Array(await hit.arrayBuffer()) : await read();
  // These bytes are always backed by a plain ArrayBuffer (from arrayBuffer() or
  // an in-memory copy), which is what c.body's typed overload expects.
  const bytes = data as Uint8Array<ArrayBuffer>;
  if (cache && !hit) {
    c.executionCtx.waitUntil(
      cache.put(cacheKey, new Response(bytes, { headers: { "Cache-Control": IMMUTABLE } })),
    );
  }
  return c.body(bytes, 200, { ...headers, "Cache-Control": IMMUTABLE });
}

const nameParam = z
  .string()
  .min(1)
  .openapi({ param: { name: "name", in: "path" }, example: "example" });
const versionParam = semverSchema.openapi({ param: { name: "version", in: "path" } });
const versionParams = z.object({ name: nameParam, version: versionParam });

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
      request: { params: versionParams },
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
      description: `Creates a package if missing, or adds a new version to an existing one. Published versions are immutable: re-publishing an existing version returns 409. Send the tarball file as \`tarball\` in multipart/form-data; a \`cpm.json\` at the tarball root ({ name, version, author?, dependencies? }) is the metadata source of truth, and the optional \`meta\` field, when sent, must match it. The tarball must be a gzipped tar of the package files at its root (no wrapping directory), with relative forward-slash paths, at most ${MAX_TARBALL_BYTES / 1024 / 1024} MiB compressed (rejected with 413 above that) and 512 KiB extracted; the registry derives the client-facing bundle from it.`,
      request: {
        body: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: z.object({
                meta: z.string().optional().openapi({
                  description:
                    "Optional cross-check: package version metadata as a JSON string, must match the tarball's cpm.json",
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
        413: jsonFail("Tarball too large"),
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
      request: { params: versionParams },
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
      return serveImmutable(c, () => serviceFor(c.env).readTarball(name, version), {
        "Content-Type": "application/gzip",
      });
    },
  );

  app.openapi(
    createRoute({
      tags: ["Packages"],
      method: "get",
      path: "/packages/{name}/{version}/dist/bundle",
      summary: "Download bundle",
      description:
        "Returns the bundle for a specific package version: the artifact the in-game cpm client installs from. Format: `<manifest byte length>\\n<minified manifest JSON><raw concatenated file bytes>`, where the manifest is `{ name, version, files: [{ path, offset, length }] }` with offsets relative to the first byte after the manifest. Served gzip-encoded on the wire to clients that send `Accept-Encoding: gzip`; `dist.bundle.sha256` is the SHA-256 of the decoded bytes.",
      request: { params: versionParams },
      responses: {
        200: {
          content: {
            "application/octet-stream": {
              schema: z.string().openapi({ type: "string", format: "binary" }),
            },
          },
          description: "Bundle bytes",
        },
        400: jsonFail("Invalid version"),
        404: jsonFail("Not found"),
        500: serverError,
      },
    }),
    async (c) => {
      const { name, version } = c.req.valid("param");
      // Workers compress the body to match an explicit Content-Encoding (the
      // default `encodeBody: "automatic"`), which is what gives the CC client
      // Java-side decompression for free without any zone compression rules.
      // Only opt in for clients that asked. In production the edge normalises
      // Accept-Encoding to "br, gzip" and transcodes for the real client; locally
      // wrangler does not transcode, so identity clients see gzip under dev only.
      const acceptsGzip = /\bgzip\b/i.test(c.req.header("accept-encoding") ?? "");
      return serveImmutable(c, () => serviceFor(c.env).readBundle(name, version), {
        "Content-Type": "application/octet-stream",
        ...(acceptsGzip ? { "Content-Encoding": "gzip" } : {}),
      });
    },
  );

  app.openapi(
    createRoute({
      tags: ["Packages"],
      method: "post",
      path: "/resolve",
      summary: "Resolve dependencies",
      description:
        "Pins one version per package for the given root dependencies and their transitive dependencies. Each spec may be a semver range, an exact version, or a dist-tag. Every requester of a package must agree on a single version (the client installs into a flat store): the highest version satisfying all requested ranges is chosen, and unsatisfiable combinations fail. Results are ordered dependencies-first.",
      request: {
        body: { required: true, content: { "application/json": { schema: resolveRequestSchema } } },
      },
      responses: {
        200: jsonSuccess(z.object({ packages: z.array(packageVersionSchema) }), "Pinned packages"),
        400: jsonFail("Invalid request or unsatisfiable dependencies"),
        404: jsonFail("Package not found"),
        500: serverError,
      },
    }),
    async (c) => {
      const { dependencies } = c.req.valid("json");
      const packages = await serviceFor(c.env).resolve(dependencies);
      return c.json({ status: "success" as const, data: { packages } }, 200);
    },
  );

  app.openapi(
    createRoute({
      tags: ["Bootstrap"],
      method: "get",
      path: "/install",
      summary: "Bootstrap installer",
      description:
        "Serves the cpm bootstrap installer as plain Lua, taken from the latest published `cpm` package. On a fresh CC:Tweaked computer run: `wget run https://registry.cpm.chungindustries.com/install`.",
      responses: {
        200: {
          content: {
            "text/plain": { schema: z.string().openapi({ example: "-- cpm installer" }) },
          },
          description: "Installer Lua source",
        },
        404: jsonFail("cpm has not been published"),
        500: serverError,
      },
    }),
    async (c) => {
      const installer = new TextDecoder().decode(await serviceFor(c.env).readInstaller());
      return c.text(installer, 200, { "Cache-Control": INSTALLER_CACHE });
    },
  );
}
