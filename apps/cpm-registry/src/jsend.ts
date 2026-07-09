import { z } from "@hono/zod-openapi";

/**
 * JSend envelope schemas: the wire contract every response follows, matching
 * the pre-Hono API. 2xx wraps data in `success`, 4xx maps to `fail`, 5xx to
 * `error` (see the `onError` handler in `index.ts` for the runtime half).
 */
export function success<T extends z.ZodTypeAny>(data: T) {
  return z.object({ status: z.literal("success"), data });
}

export const failSchema = z.object({
  status: z.literal("fail"),
  data: z.object({ message: z.string().min(1) }),
});

export const errorSchema = z.object({ status: z.literal("error"), message: z.string().min(1) });

/** OpenAPI response entry for a JSend `fail` (4xx). */
export const jsonFail = (description: string) => ({
  content: { "application/json": { schema: failSchema } },
  description,
});

/** OpenAPI response entry for a JSend `error` (5xx). */
export const serverError = {
  content: { "application/json": { schema: errorSchema } },
  description: "Unexpected error",
};
