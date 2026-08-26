import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";

// `Env` is generated from wrangler.toml by `pnpm gen-types` (worker-configuration.d.ts),
// so the bindings the code sees cannot drift from the ones the runtime injects.
const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => c.redirect("/cpm-registry"));

// The spec is fetched same-origin by the reference UI and proxied to the
// registry Worker over the service binding (the hostname is arbitrary; service
// bindings route by binding, not DNS).
app.get("/cpm-registry/openapi.json", (c) =>
  c.env.REGISTRY.fetch("https://cpm-registry/openapi.json"),
);

app.get(
  "/cpm-registry",
  Scalar({
    url: "/cpm-registry/openapi.json",
    pageTitle: "CPM Registry API | ChungIndustries",
    // Explicit so Scalar's stock default theme renders; with no theme set, the
    // hono integration injects its own orange-accent custom CSS instead.
    theme: "default",
  }),
);

export default app;
