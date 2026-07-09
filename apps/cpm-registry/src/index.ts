import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { Bindings } from "./bindings.js";
import { registerPackageRoutes } from "./components/package/routes.js";
import { RegistryError } from "./errors.js";

/** Static half of the OpenAPI document; the paths are filled in from the routes. */
export const openApiBase = {
  openapi: "3.0.0",
  info: {
    title: "CPM Registry",
    version: "0.0.0-development",
    description:
      "API for the CPM Registry, used by the Chung Package Manager (cpm) to host and distribute ComputerCraft-focused Lua packages.",
  },
  servers: [{ url: "https://registry.cpm.chungindustries.com" }],
  tags: [{ name: "Packages", description: "Endpoints for browsing and retrieving cpm packages." }],
};

export const app = new OpenAPIHono<{ Bindings: Bindings }>({
  // Input (params/query/body) validation failures become JSend `fail`.
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json({ status: "fail", data: { message: z.prettifyError(result.error) } }, 400);
    }
  },
});

app.onError((err, c) => {
  if (err instanceof RegistryError) {
    const status = err.status as ContentfulStatusCode;
    if (err.status >= 400 && err.status < 500) {
      return c.json({ status: "fail", data: { message: err.message } }, status);
    }
    return c.json({ status: "error", message: err.message }, status);
  }
  if (err instanceof z.ZodError) {
    return c.json({ status: "fail", data: { message: z.prettifyError(err) } }, 400);
  }
  console.error(err);
  return c.json({ status: "error", message: "Internal Server Error" }, 500);
});

registerPackageRoutes(app);

// Serve the generated spec at runtime as well as via `gen-docs`.
app.doc("/openapi.json", openApiBase);

export default app;
