import { type OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import { SCOPES, type AppEnv } from "@/components/auth/actor";
import { requireScope } from "@/components/auth/middleware";
import { PackageService } from "@/components/package/service";
import { D1RegistryStore } from "@/components/package/store/d1";
import { R2BlobStore } from "@/components/package/store/r2";
import { jsonFail, jsonSuccess, serverError } from "@/jsend";

type App = OpenAPIHono<AppEnv>;

const actorSchema = z
  .object({
    userId: z.string(),
    via: z.enum(["token", "session"]),
    scopes: z.array(z.enum(SCOPES)),
  })
  .openapi("Actor");

const maintainedPackagesSchema = z.object({
  packages: z.array(
    z.object({
      name: z.string(),
      role: z.enum(["owner", "maintainer"]),
    }),
  ),
});

export function registerAccountRoutes(app: App): void {
  app.openapi(
    createRoute({
      tags: ["Account"],
      method: "get",
      path: "/me",
      summary: "Who am I",
      description:
        "Returns the authenticated identity behind the supplied credential: a publish token (`Authorization: Bearer cpm_...`) or a browser session. Useful as a token smoke test in CI and tooling.",
      middleware: [requireScope()] as const,
      security: [{ publishToken: [] }],
      responses: {
        200: jsonSuccess(actorSchema, "The authenticated actor"),
        401: jsonFail("Not authenticated"),
        500: serverError,
      },
    }),
    (c) => {
      const { userId, via, scopes } = c.get("actor");
      return c.json({ status: "success" as const, data: { userId, via, scopes: [...scopes] } }, 200);
    },
  );

  app.openapi(
    createRoute({
      tags: ["Account"],
      method: "get",
      path: "/me/packages",
      summary: "List my packages",
      description: "Returns the packages the authenticated user owns or maintains.",
      middleware: [requireScope()] as const,
      security: [{ publishToken: [] }],
      responses: {
        200: jsonSuccess(maintainedPackagesSchema, "Maintained packages"),
        401: jsonFail("Not authenticated"),
        500: serverError,
      },
    }),
    async (c) => {
      const service = new PackageService(
        new D1RegistryStore(c.env.DB),
        new R2BlobStore(c.env.BUCKET),
      );
      const packages = await service.maintained(c.get("actor").userId);
      return c.json({ status: "success" as const, data: { packages } }, 200);
    },
  );
}
