import { type OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";

import type { AppEnv } from "@/components/auth/actor";
import { requireActorScope } from "@/components/auth/middleware";
import {
  handleSchema,
  maintainersSchema,
  packageSchema,
  packageVersionSchema,
  resolveRequestSchema,
  searchQuerySchema,
  searchResultsSchema,
  semverSchema,
} from "@/components/package/schemas";
import { MAX_TARBALL_BYTES, PackageService } from "@/components/package/service";
import { D1RegistryStore } from "@/components/package/store/d1";
import { R2BlobStore } from "@/components/package/store/r2";
import { BadRequestError, PayloadTooLargeError } from "@/errors";
import { jsonFail, jsonSuccess, serverError } from "@/jsend";

type App = OpenAPIHono<AppEnv>;
type Ctx = Context<AppEnv>;

function serviceFor(env: Env): PackageService {
  return new PackageService(new D1RegistryStore(env.DB), new R2BlobStore(env.BUCKET));
}

/** Validates the multipart publish form into raw tarball bytes. */
async function parsePublishForm(form: { tarball: unknown }): Promise<Uint8Array> {
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
  return new Uint8Array(await form.tarball.arrayBuffer());
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
const handleParam = handleSchema.openapi({ param: { name: "handle", in: "path" } });
const maintainerParams = z.object({ name: nameParam, handle: handleParam });

/**
 * Maintainer management (docs/cpm-registry-auth-design.md, section 8.2).
 * Registered before `GET /packages/{name}/{version}`: Hono runs every matching
 * route in registration order, and that route's semver validation would turn
 * `/packages/{name}/maintainers` into a 400 before this handler ran.
 */
function registerMaintainerRoutes(app: App): void {
  app.openapi(
    createRoute({
      tags: ["Maintainers"],
      method: "get",
      path: "/packages/{name}/maintainers",
      summary: "List maintainers",
      description:
        "Lists who maintains the package: the owner first, then everyone else in the order they were added.",
      request: { params: z.object({ name: nameParam }) },
      responses: {
        200: jsonSuccess(maintainersSchema, "The maintainers"),
        404: jsonFail("Package not found"),
        500: serverError,
      },
    }),
    async (c) => {
      const maintainers = await serviceFor(c.env).listMaintainers(c.req.valid("param").name);
      return c.json({ status: "success" as const, data: { maintainers } }, 200);
    },
  );

  app.openapi(
    createRoute({
      tags: ["Maintainers"],
      method: "put",
      path: "/packages/{name}/maintainers/{handle}",
      summary: "Add maintainer",
      description:
        "Adds the account with this handle as a maintainer, so it can publish new versions. Only the owner can do this, and the credential needs the `manage` scope. Adding someone who already maintains the package does nothing. Responds with the updated list.",
      middleware: [requireActorScope("manage")] as const,
      security: [{ publishToken: [] }],
      request: { params: maintainerParams },
      responses: {
        200: jsonSuccess(maintainersSchema, "The updated maintainers"),
        400: jsonFail("Invalid handle"),
        401: jsonFail("Not authenticated"),
        403: jsonFail("Not the package owner, or missing the manage scope"),
        404: jsonFail("Package or account not found"),
        500: serverError,
      },
    }),
    async (c) => {
      const { name, handle } = c.req.valid("param");
      const maintainers = await serviceFor(c.env).addMaintainer(c.get("actor"), name, handle);
      return c.json({ status: "success" as const, data: { maintainers } }, 200);
    },
  );

  app.openapi(
    createRoute({
      tags: ["Maintainers"],
      method: "delete",
      path: "/packages/{name}/maintainers/{handle}",
      summary: "Remove maintainer",
      description:
        "Removes the account with this handle from the maintainers, so it can no longer publish. Only the owner can do this, and the credential needs the `manage` scope. The owner cannot be removed this way; to change who owns the package, transfer it instead. Responds with the updated list.",
      middleware: [requireActorScope("manage")] as const,
      security: [{ publishToken: [] }],
      request: { params: maintainerParams },
      responses: {
        200: jsonSuccess(maintainersSchema, "The updated maintainers"),
        400: jsonFail("Invalid handle, or the owner's handle"),
        401: jsonFail("Not authenticated"),
        403: jsonFail("Not the package owner, or missing the manage scope"),
        404: jsonFail("Package or account not found, or not a maintainer"),
        500: serverError,
      },
    }),
    async (c) => {
      const { name, handle } = c.req.valid("param");
      const maintainers = await serviceFor(c.env).removeMaintainer(c.get("actor"), name, handle);
      return c.json({ status: "success" as const, data: { maintainers } }, 200);
    },
  );
}

export function registerPackageRoutes(app: App): void {
  app.openapi(
    createRoute({
      tags: ["Packages"],
      method: "get",
      path: "/packages",
      summary: "List packages",
      description: "Lists every package in the registry, each with all of its versions.",
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
      path: "/search",
      summary: "Search packages",
      description:
        "Searches package names, authors, and descriptions for `q` (case-insensitive, anywhere in the text) and returns one summary per match instead of the full package. Exact name matches come first, then names starting with the query, then other name matches, then matches on author or description, with ties ordered by name. Leave `q` empty to page through every package. `limit` and `offset` pick the page, and `total` counts matches across all pages.",
      request: { query: searchQuerySchema },
      responses: {
        200: jsonSuccess(searchResultsSchema, "Matching packages"),
        400: jsonFail("Invalid query parameters"),
        500: serverError,
      },
    }),
    async (c) => {
      const { q, limit, offset } = c.req.valid("query");
      const data = await serviceFor(c.env).search(q, { limit, offset });
      return c.json({ status: "success" as const, data }, 200);
    },
  );

  app.openapi(
    createRoute({
      tags: ["Packages"],
      method: "get",
      path: "/packages/{name}",
      summary: "Get package",
      description: "Returns the package with all of its versions and dist-tags.",
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

  registerMaintainerRoutes(app);

  app.openapi(
    createRoute({
      tags: ["Packages"],
      method: "get",
      path: "/packages/{name}/{version}",
      summary: "Get package version",
      description: "Returns one version of the package.",
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
      description: `Publishes a version: creates the package if the name is new, or adds the version to an existing one. The first publish of a new name makes you its owner, and from then on only its maintainers can publish. The token needs the \`publish\` scope. Versions are immutable, so publishing an existing version again fails with 409. Send the tarball as the \`tarball\` field of a multipart form. It must be a gzipped tar with the package files at its root (no wrapping directory) and relative forward-slash paths, including the \`cpm.json\` that holds the package metadata, at most ${MAX_TARBALL_BYTES / 1024 / 1024} MiB compressed (413 above that) and 512 KiB extracted. The registry builds the bundle the in-game client installs from it.`,
      middleware: [requireActorScope("publish")] as const,
      security: [{ publishToken: [] }],
      request: {
        body: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: z.object({
                tarball: z.any().openapi({
                  type: "string",
                  format: "binary",
                  description: "The gzipped tarball",
                }),
              }),
            },
          },
        },
      },
      responses: {
        201: jsonSuccess(packageSchema, "Published"),
        400: jsonFail("Invalid request"),
        401: jsonFail("Not authenticated"),
        403: jsonFail("Not a maintainer of this package, or missing the publish scope"),
        409: jsonFail("Version already published"),
        413: jsonFail("Tarball too large"),
        500: serverError,
      },
    }),
    async (c) => {
      const data = await parsePublishForm(c.req.valid("form"));
      const pkg = await serviceFor(c.env).publish(c.get("actor"), data);
      return c.json({ status: "success" as const, data: pkg }, 201);
    },
  );

  app.openapi(
    createRoute({
      tags: ["Packages"],
      method: "get",
      path: "/packages/{name}/{version}/dist/tarball",
      summary: "Download tarball",
      description: "Downloads the gzipped tarball exactly as it was published for this version.",
      request: { params: versionParams },
      responses: {
        200: {
          content: {
            "application/gzip": {
              schema: z.string().openapi({ type: "string", format: "binary" }),
            },
          },
          description: "The tarball",
        },
        400: jsonFail("Invalid version"),
        404: jsonFail("Package or version not found"),
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
        "Downloads the bundle for this version, which is what the in-game cpm client installs from. It starts with the manifest's byte length and a newline, then the minified manifest JSON, then the raw file bytes back to back. The manifest is `{ name, version, files: [{ path, offset, length }] }`, with offsets counted from the first byte after the manifest. Clients that send `Accept-Encoding: gzip` get it gzip-encoded on the wire; `dist.bundle.sha256` is the SHA-256 of the decoded bytes.",
      request: { params: versionParams },
      responses: {
        200: {
          content: {
            "application/octet-stream": {
              schema: z.string().openapi({ type: "string", format: "binary" }),
            },
          },
          description: "The bundle",
        },
        400: jsonFail("Invalid version"),
        404: jsonFail("Package or version not found"),
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
        "Picks one version for each of the given dependencies and for everything they depend on in turn. Each spec can be a semver range, an exact version, or a dist-tag. The client installs into a flat store, so every package gets a single version: the highest one that satisfies everyone asking for it. If no version can, the request fails. The result lists dependencies before the packages that need them.",
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
        "Serves the cpm installer as plain Lua, straight from the latest published `cpm` package. On a fresh CC:Tweaked computer, run `wget run https://registry.cpm.chungindustries.com/install`.",
      responses: {
        200: {
          content: {
            "text/plain": { schema: z.string().openapi({ example: "-- cpm installer" }) },
          },
          description: "The installer",
        },
        404: jsonFail("cpm has not been published yet"),
        500: serverError,
      },
    }),
    async (c) => {
      const installer = new TextDecoder().decode(await serviceFor(c.env).readInstaller());
      return c.text(installer, 200, { "Cache-Control": INSTALLER_CACHE });
    },
  );
}
