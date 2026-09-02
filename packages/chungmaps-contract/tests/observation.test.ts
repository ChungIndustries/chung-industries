import { describe, expect, it } from "vitest";

import {
  AIR,
  MAX_BATCH_SIZE,
  observationBatchSchema,
  observationSchema,
  sectionSchema,
  storedBlockSchema,
} from "../src";

const stone = { x: 10, y: 64, z: -20, block: "minecraft:stone" };

describe("observation", () => {
  it("accepts a block with optional state", () => {
    expect(observationSchema.safeParse(stone).success).toBe(true);
    expect(
      observationSchema.safeParse({ ...stone, block: "minecraft:oak_log", state: { axis: "y" } })
        .success,
    ).toBe(true);
  });

  it("accepts air", () => {
    expect(observationSchema.safeParse({ ...stone, block: AIR }).success).toBe(true);
  });

  it("does not carry a timestamp", () => {
    const parsed = observationSchema.parse({ ...stone, observedAt: "2026-01-01T00:00:00Z" });
    expect(parsed).not.toHaveProperty("observedAt");
  });
});

describe("observation batch", () => {
  it("accepts a batch of one, as send-each mode posts", () => {
    const batch = { dimension: "minecraft:overworld", observations: [stone] };
    expect(observationBatchSchema.safeParse(batch).success).toBe(true);
  });

  it("rejects an empty batch", () => {
    const batch = { dimension: "minecraft:overworld", observations: [] };
    expect(observationBatchSchema.safeParse(batch).success).toBe(false);
  });

  it("caps the batch size", () => {
    const observations = Array.from({ length: MAX_BATCH_SIZE + 1 }, () => stone);
    const batch = { dimension: "minecraft:overworld", observations };
    expect(observationBatchSchema.safeParse(batch).success).toBe(false);
    expect(
      observationBatchSchema.safeParse({ ...batch, observations: observations.slice(1) }).success,
    ).toBe(true);
  });
});

describe("stored blocks and sections", () => {
  const stored = { ...stone, observedAt: "2026-01-01T00:00:00.000Z", turtleId: "t_1" };

  it("requires the server-assigned timestamp and the observing turtle", () => {
    expect(storedBlockSchema.safeParse(stored).success).toBe(true);
    expect(storedBlockSchema.safeParse(stone).success).toBe(false);
  });

  it("serves a section as a sparse block list", () => {
    const section = { dimension: "minecraft:overworld", sx: 0, sy: 4, sz: -2, blocks: [stored] };
    expect(sectionSchema.safeParse(section).success).toBe(true);
    expect(sectionSchema.safeParse({ ...section, blocks: [] }).success).toBe(true);
  });
});
