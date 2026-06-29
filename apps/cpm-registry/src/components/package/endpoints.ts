import {
  EndpointsFactory,
  ez,
  ResultHandler,
  ensureHttpError,
  getMessageFromError,
} from "express-zod-api";
import { z } from "zod";

import {
  packageSchema,
  packageVersionMetadataSchema,
  packageVersionSchema,
  semverSchema,
} from "./schemas.js";
import { PackageService } from "./service.js";

const failSchema = z.object({
  status: z.literal("fail"),
  data: z.object({ message: z.string().nonempty() }),
});
const errorSchema = z.object({ status: z.literal("error"), message: z.string().nonempty() });

function makeFactory(
  negative: { statusCode: number | [number, ...number[]]; schema: z.ZodTypeAny }[],
  successStatus: number = 200,
) {
  return new EndpointsFactory(
    new ResultHandler({
      positive: (data) => ({
        schema: z.object({ status: z.literal("success"), data }),
      }),
      negative,
      handler: ({ error, output, response }) => {
        if (error) {
          const httpError = ensureHttpError(error);
          const message = getMessageFromError(error);

          if (400 <= httpError.statusCode && httpError.statusCode < 500) {
            return void response
              .status(httpError.statusCode)
              .json({ status: "fail", data: { message } });
          }

          return void response.status(httpError.statusCode).json({ status: "error", message });
        }

        return void response.status(successStatus).json({ status: "success", data: output });
      },
    }),
  );
}

const service = new PackageService();

const listFactory = makeFactory([{ statusCode: 500, schema: errorSchema }]);
export const listPackagesEndpoint = listFactory.build({
  tag: "Packages",
  shortDescription: "List packages",
  description: "Returns all CPM packages in the registry.",
  method: "get",
  input: z.object({}),
  output: z.object({ packages: z.array(packageSchema) }),
  handler: async () => ({ packages: await service.list() }),
});

const getFactory = makeFactory([
  { statusCode: [400], schema: failSchema },
  {
    statusCode: 404,
    schema: z.object({
      status: z.literal("fail"),
      data: z.object({
        message: z.union([z.literal("Package not found"), z.literal("Package version not found")]),
      }),
    }),
  },
  { statusCode: 500, schema: errorSchema },
]);
export const getPackageEndpoint = getFactory.build({
  tag: "Packages",
  shortDescription: "Get package",
  description: "Returns the CPM package entry for the given package name.",
  method: "get",
  input: z.object({ name: z.string().nonempty() }),
  output: packageSchema,
  handler: async ({ input }) => service.get(input.name),
});

export const getPackageVersionEndpoint = getFactory.build({
  tag: "Packages",
  shortDescription: "Get package version",
  description: "Returns the specific version entry for the given package.",
  method: "get",
  input: z.object({ name: z.string().nonempty(), version: semverSchema }),
  output: packageVersionSchema,
  handler: async ({ input }) => service.getVersion(input.name, input.version),
});

const upsertFactory = makeFactory(
  [
    { statusCode: 400, schema: failSchema },
    { statusCode: 500, schema: errorSchema },
  ],
  201,
);
export const upsertPackageEndpoint = upsertFactory.build({
  tag: "Packages",
  shortDescription: "Publish or update package",
  description:
    "Creates a package if missing, or adds/replaces a version. Send metadata JSON as `meta` plus the tarball file as `tarball` in multipart/form-data.",
  method: "post",
  input: z.object({
    meta: z.preprocess((value) => {
      if (typeof value === "string") {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }

      return value;
    }, packageVersionMetadataSchema),
    tarball: ez.upload(),
  }),
  output: packageSchema,
  handler: async ({ input }) => await service.upsert(input.meta, input.tarball),
});
