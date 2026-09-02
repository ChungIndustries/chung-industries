import { z } from "zod";

import { dimensionIdSchema, facingSchema, positionSchema } from "./world";

export const turtleIdSchema = z.string().min(1).meta({ description: "Server-assigned turtle id" });
export type TurtleId = z.infer<typeof turtleIdSchema>;

export const turtleNameSchema = z.string().trim().min(1).max(64).meta({
  description: "Display name chosen by the owner",
  example: "Digger 3",
});

// turtle.getFuelLevel returns a number, or "unlimited" when fuel is disabled.
export const fuelSchema = z.union([z.int().nonnegative(), z.literal("unlimited")]);
export type Fuel = z.infer<typeof fuelSchema>;

/** Where a turtle is and which way it faces. */
export const turtlePositionSchema = positionSchema.extend({
  dimension: dimensionIdSchema,
  facing: facingSchema,
});
export type TurtlePosition = z.infer<typeof turtlePositionSchema>;

/** What a turtle reports on an interval so the map can show it. */
export const turtleHeartbeatSchema = turtlePositionSchema.extend({
  fuel: fuelSchema,
});
export type TurtleHeartbeat = z.infer<typeof turtleHeartbeatSchema>;

/** The last heartbeat, stamped with the server time it arrived. */
export const turtleStatusSchema = turtleHeartbeatSchema.extend({
  reportedAt: z.iso.datetime(),
});
export type TurtleStatus = z.infer<typeof turtleStatusSchema>;

export const turtleSchema = z.object({
  id: turtleIdSchema,
  name: turtleNameSchema,
  ownerId: z.string().min(1),
  createdAt: z.iso.datetime(),
  /** Last authenticated call of any kind, or null before enrolment completes. */
  lastSeenAt: z.iso.datetime().nullable(),
  /** Null until the first heartbeat. */
  status: turtleStatusSchema.nullable(),
});
export type Turtle = z.infer<typeof turtleSchema>;
