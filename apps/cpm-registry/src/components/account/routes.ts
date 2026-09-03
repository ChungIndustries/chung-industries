import { type OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import { SCOPES, type AppEnv } from "@/components/auth/actor";
import { requireActor } from "@/components/auth/middleware";
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
        "Tells you which account your publish token or browser session belongs to, and which scopes it holds. Handy for checking a token from CI.",
      middleware: [requireActor()] as const,
      security: [{ publishToken: [] }],
      responses: {
        200: jsonSuccess(actorSchema, "Your account and scopes"),
        401: jsonFail("Not authenticated"),
        500: serverError,
      },
    }),
    (c) => {
      const { userId, via, scopes } = c.get("actor");
      return c.json(
        { status: "success" as const, data: { userId, via, scopes: [...scopes] } },
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      tags: ["Account"],
      method: "get",
      path: "/me/packages",
      summary: "List my packages",
      description: "Lists the packages you own or maintain.",
      middleware: [requireActor()] as const,
      security: [{ publishToken: [] }],
      responses: {
        200: jsonSuccess(maintainedPackagesSchema, "Your packages"),
        401: jsonFail("Not authenticated"),
        500: serverError,
      },
    }),
    async (c) => {
      const service = new PackageService(
        new D1RegistryStore(c.env.DB),
        new R2BlobStore(c.env.BUCKET),
      );
      const packages = await service.maintainedBy(c.get("actor").userId);
      return c.json({ status: "success" as const, data: { packages } }, 200);
    },
  );
}
