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

const publishFactory = makeFactory(
  [
    { statusCode: 400, schema: failSchema },
    { statusCode: 409, schema: failSchema },
    { statusCode: 500, schema: errorSchema },
  ],
  201,
);
export const publishPackageEndpoint = publishFactory.build({
  tag: "Packages",
  shortDescription: "Publish package version",
  description:
    "Creates a package if missing, or adds a new version to an existing one. Published versions are immutable: re-publishing an existing version returns 409. Send metadata JSON as `meta` plus the tarball file as `tarball` in multipart/form-data.",
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
  handler: async ({ input }) => await service.publish(input.meta, input.tarball),
});

const downloadFactory = new EndpointsFactory(
  new ResultHandler({
    positive: { schema: ez.buffer(), mimeType: "application/gzip" },
    negative: [
      { statusCode: [400, 404], schema: failSchema },
      { statusCode: 500, schema: errorSchema },
    ],
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

      // `output` is loosely typed as FlatObject; the endpoint guarantees a Buffer
      // here, which is what the branded buffer response schema expects.
      const tarball = output.data as Parameters<typeof response.send>[0];
      return void response.type("application/gzip").send(tarball);
    },
  }),
);
export const downloadTarballEndpoint = downloadFactory.build({
  tag: "Packages",
  shortDescription: "Download tarball",
  description: "Returns the gzipped tarball bytes for a specific package version.",
  method: "get",
  input: z.object({ name: z.string().nonempty(), version: semverSchema }),
  output: z.object({ data: ez.buffer() }),
  handler: async ({ input }) => ({ data: await service.readTarball(input.name, input.version) }),
});
