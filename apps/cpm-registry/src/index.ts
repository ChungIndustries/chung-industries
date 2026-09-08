import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { registerAccountRoutes } from "@/components/account/routes";
import type { AppEnv } from "@/components/auth/actor";
import { authFor } from "@/components/auth/instance";
import { registerPackageRoutes } from "@/components/package/routes";
import { RegistryError } from "@/errors";

import packageJson from "../package.json";

/** Static half of the OpenAPI document; the paths are filled in from the routes. */
export const openApiBase = {
  openapi: "3.0.0",
  info: {
    title: "CPM Registry",
    // The release PR bumps package.json and regenerates openapi.yaml in the same
    // commit (tools/release.mjs prepare), so the published spec always carries the
    // released version.
    version: packageJson.version,
    description:
      "The registry behind the Chung Package Manager (cpm): where Lua packages for ComputerCraft are published, browsed, and installed from.",
  },
  servers: [{ url: "https://registry.cpm.chungindustries.com" }],
  tags: [
    { name: "Packages", description: "Browsing, downloading, and publishing packages." },
    { name: "Maintainers", description: "Who may publish a package, managed by its owner." },
    { name: "Bootstrap", description: "Getting cpm onto a fresh computer." },
    { name: "Account", description: "The signed-in account and its packages." },
  ],
};

// `Env` is generated from wrangler.toml by `pnpm gen-types` (worker-configuration.d.ts),
// so the bindings the code sees cannot drift from the ones the runtime injects.
export const app = new OpenAPIHono<AppEnv>({
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
      // RFC 7235: a 401 names the credential scheme the endpoint expects.
      const headers = err.status === 401 ? { "WWW-Authenticate": "Bearer" } : undefined;
      return c.json({ status: "fail", data: { message: err.message } }, status, headers);
    }
    return c.json({ status: "error", message: err.message }, status);
  }
  if (err instanceof z.ZodError) {
    return c.json({ status: "fail", data: { message: z.prettifyError(err) } }, 400);
  }
  console.error(err);
  return c.json({ status: "error", message: "Internal Server Error" }, 500);
});

// Better Auth owns everything under /auth/* (GitHub OAuth, sessions, API
// keys). These routes are library-native and intentionally outside both the
// JSend envelope and the generated OpenAPI document.
app.on(["GET", "POST"], "/auth/*", (c) => authFor(c.env).handler(c.req.raw));

// The two credentials in the OpenAPI document; routes opt in via `security`.
// A publish token only ever publishes; changing who owns or maintains a
// package needs the website sign-in (docs/cpm-registry-auth-design.md, 10.3).
app.openAPIRegistry.registerComponent("securitySchemes", "publishToken", {
  type: "http",
  scheme: "bearer",
  description:
    "A publish token from your account page at https://cpm.chungindustries.com/account, sent as `Authorization: Bearer cpm_...`.",
});
app.openAPIRegistry.registerComponent("securitySchemes", "session", {
  type: "apiKey",
  in: "cookie",
  // Better Auth's default name, `__Secure-` prefixed because BETTER_AUTH_URL is https.
  name: "__Secure-better-auth.session_token",
  description:
    "Your sign-in on https://cpm.chungindustries.com, which the website sends for you. Publish tokens are not accepted here.",
});

registerPackageRoutes(app);
registerAccountRoutes(app);

// Serve the generated spec at runtime as well as via `gen-docs`.
app.doc("/openapi.json", openApiBase);

export default app;
