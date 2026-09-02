import { describe, expect, it } from "vitest";

import {
  TURTLE_KEY_PREFIX,
  createTurtleSchema,
  enrollmentResultSchema,
  turtleHeartbeatSchema,
  turtleSchema,
} from "../src";

const heartbeat = {
  dimension: "minecraft:overworld",
  x: 0,
  y: 70,
  z: 0,
  facing: "north",
  fuel: 1200,
};

describe("heartbeat", () => {
  it("accepts a numeric fuel level", () => {
    expect(turtleHeartbeatSchema.safeParse(heartbeat).success).toBe(true);
  });

  it("accepts unlimited fuel", () => {
    expect(turtleHeartbeatSchema.safeParse({ ...heartbeat, fuel: "unlimited" }).success).toBe(true);
  });

  it("rejects an unknown facing", () => {
    expect(turtleHeartbeatSchema.safeParse({ ...heartbeat, facing: "up" }).success).toBe(false);
  });
});

describe("turtle", () => {
  const turtle = {
    id: "t_1",
    name: "Digger 3",
    ownerId: "u_1",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastSeenAt: null,
    status: null,
  };

  it("has no status before the first heartbeat", () => {
    expect(turtleSchema.safeParse(turtle).success).toBe(true);
  });

  it("carries the last heartbeat with its server time", () => {
    const status = { ...heartbeat, reportedAt: "2026-01-01T00:05:00.000Z" };
    expect(turtleSchema.safeParse({ ...turtle, status }).success).toBe(true);
    expect(turtleSchema.safeParse({ ...turtle, status: heartbeat }).success).toBe(false);
  });

  it("trims and bounds the name", () => {
    expect(createTurtleSchema.parse({ name: "  Digger 3 " })).toEqual({ name: "Digger 3" });
    expect(createTurtleSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(createTurtleSchema.safeParse({ name: "x".repeat(65) }).success).toBe(false);
  });

  it("only returns keys with the turtle prefix", () => {
    const result = { turtle, key: `${TURTLE_KEY_PREFIX}abc` };
    expect(enrollmentResultSchema.safeParse(result).success).toBe(true);
    expect(enrollmentResultSchema.safeParse({ turtle, key: "cpm_abc" }).success).toBe(false);
  });
});
