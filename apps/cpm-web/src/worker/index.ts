import { Hono } from "hono";

import { readReadme } from "@/worker/bundle";

/**
 * The site's API: a thin same-origin proxy in front of the cpm-registry Worker.
 * Only /api/* reaches this script (wrangler.toml `run_worker_first`); every
 * other path is served from the built SPA assets. Responses keep the registry's
 * JSend envelope so the client unwraps everything uniformly.
 */

// `Env` is generated from wrangler.toml by `pnpm gen-types` (worker-configuration.d.ts),
// so the bindings the code sees cannot drift from the ones the runtime injects.
const app = new Hono<{ Bindings: Env }>();

// The hostname is arbitrary; service bindings route by binding, not DNS.
const REGISTRY = "https://cpm-registry";

app.get("/api/packages", (c) => c.env.REGISTRY.fetch(`${REGISTRY}/packages`));

app.get("/api/packages/:name", (c) =>
  c.env.REGISTRY.fetch(`${REGISTRY}/packages/${encodeURIComponent(c.req.param("name"))}`),
);

app.get("/api/packages/:name/:version/readme", async (c) => {
  const { name, version } = c.req.param();
  const path = `/packages/${encodeURIComponent(name)}/${encodeURIComponent(version)}/dist/bundle`;
  // No Accept-Encoding is sent, so the registry serves identity bytes.
  const response = await c.env.REGISTRY.fetch(`${REGISTRY}${path}`);
  if (!response.ok) {
    return c.json({ status: "fail" as const, data: { message: "Package or version not found" } }, 404);
  }
  const bundle = new Uint8Array(await response.arrayBuffer());
  const readme = readReadme(bundle);
  // Published versions are immutable, so the extracted README is too.
  return c.json(
    { status: "success" as const, data: { readme } },
    200,
    { "Cache-Control": "public, max-age=31536000, immutable" },
  );
});

app.notFound((c) => c.json({ status: "fail" as const, data: { message: "Not found" } }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ status: "error" as const, message: "Internal Server Error" }, 500);
});

export default app;
