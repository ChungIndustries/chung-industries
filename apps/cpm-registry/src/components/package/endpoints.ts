import type { OpenAPIHono } from "@hono/zod-openapi";

import type { Bindings } from "../../bindings.js";
import { BadRequestError } from "../../errors.js";
import {
  downloadTarballRoute,
  getPackageRoute,
  getPackageVersionRoute,
  listPackagesRoute,
  publishPackageRoute,
} from "./routes.js";
import { packageVersionMetadataSchema, type PackageVersionMetadata } from "./schemas.js";
import { PackageService } from "./service.js";
import { D1RegistryStore } from "./store/d1.js";
import { R2TarballStore } from "./store/r2.js";

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

export function registerPackageRoutes(app: App): void {
  app.openapi(listPackagesRoute, async (c) =>
    c.json({ status: "success" as const, data: { packages: await serviceFor(c.env).list() } }, 200),
  );

  app.openapi(getPackageRoute, async (c) =>
    c.json(
      { status: "success" as const, data: await serviceFor(c.env).get(c.req.valid("param").name) },
      200,
    ),
  );

  app.openapi(getPackageVersionRoute, async (c) => {
    const { name, version } = c.req.valid("param");
    return c.json(
      { status: "success" as const, data: await serviceFor(c.env).getVersion(name, version) },
      200,
    );
  });

  app.openapi(publishPackageRoute, async (c) => {
    const { meta, data } = await parsePublishForm(c.req.valid("form"));
    const pkg = await serviceFor(c.env).publish(meta, data);
    return c.json({ status: "success" as const, data: pkg }, 201);
  });

  app.openapi(downloadTarballRoute, async (c) => {
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
  });
}
