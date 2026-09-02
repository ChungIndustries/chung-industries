import { z } from "zod";

import { turtleIdSchema, turtleNameSchema, turtleSchema } from "./turtle";

/** Prefix of every turtle API key, so a pasted key is recognisable at a glance. */
export const TURTLE_KEY_PREFIX = "chungmaps_";

/** What the owner sends to create a turtle in the web app. */
export const createTurtleSchema = z.object({
  name: turtleNameSchema,
});
export type CreateTurtle = z.infer<typeof createTurtleSchema>;

const enrollmentTokenSchema = z.string().min(1).meta({
  description: "Single-use, short-lived token shown to the owner once",
});

/** Returned to the owner once, to paste into `chungmaps login` on the turtle. */
export const enrollmentSchema = z.object({
  turtleId: turtleIdSchema,
  token: enrollmentTokenSchema,
  expiresAt: z.iso.datetime(),
});
export type Enrollment = z.infer<typeof enrollmentSchema>;

/** What the turtle posts to trade its enrolment token for a key. */
export const enrollmentExchangeSchema = z.object({
  token: enrollmentTokenSchema,
});
export type EnrollmentExchange = z.infer<typeof enrollmentExchangeSchema>;

/** The turtle's identity and its key. The key is only ever returned here. */
export const enrollmentResultSchema = z.object({
  turtle: turtleSchema,
  key: z.string().startsWith(TURTLE_KEY_PREFIX),
});
export type EnrollmentResult = z.infer<typeof enrollmentResultSchema>;
