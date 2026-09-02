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
    name: z.string().openapi({ description: "The user's display name" }),
    via: z.enum(["token", "session"]).openapi({ description: "How the caller authenticated" }),
    scopes: z.array(z.enum(SCOPES)),
    token: z
      .object({
        name: z
          .string()
          .nullable()
          .openapi({ description: "The token's name on the account page" }),
        expiresAt: z.iso
          .datetime()
          .nullable()
          .openapi({ description: "Expiry, ISO 8601 UTC; null for a token that never expires" }),
      })
      .optional()
      .openapi({ description: "The publish token used; absent for a browser session" }),
  })
  .openapi("Actor", {
    example: {
      userId: "3f2c1e9a",
      name: "chrille0313",
      via: "token",
      scopes: ["publish"],
      token: { name: "laptop", expiresAt: "2026-12-01T00:00:00.000Z" },
    },
  });

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
        "Returns the authenticated identity behind the supplied credential: a publish token (`Authorization: Bearer cpm_...`) or a browser session, with the token's name and expiry when one was used. What `cpm whoami` prints, and a token smoke test for CI.",
      middleware: [requireActor()] as const,
      security: [{ publishToken: [] }],
      responses: {
        200: jsonSuccess(actorSchema, "The authenticated actor"),
        401: jsonFail("Not authenticated"),
        500: serverError,
      },
    }),
    (c) => {
      const { userId, name, via, scopes, token } = c.get("actor");
      return c.json(
        { status: "success" as const, data: { userId, name, via, scopes: [...scopes], token } },
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
      description: "Returns the packages the authenticated user owns or maintains.",
      middleware: [requireActor()] as const,
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
      const packages = await service.maintainedBy(c.get("actor").userId);
      return c.json({ status: "success" as const, data: { packages } }, 200);
    },
  );
}
