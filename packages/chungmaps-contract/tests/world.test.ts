import { describe, expect, it } from "vitest";

import {
  SECTION_SIZE,
  blockIdSchema,
  blockStateSchema,
  blockTypeSchema,
  dimensionIdSchema,
  sectionOf,
  positionSchema,
} from "../src";

describe("namespaced ids", () => {
  it.each(["minecraft:overworld", "minecraft:the_nether", "ae2:spatial_storage"])(
    "accepts %s as a dimension",
    (id) => {
      expect(dimensionIdSchema.safeParse(id).success).toBe(true);
    },
  );

  it.each(["minecraft:stone", "minecraft:oak_log", "create:andesite_casing"])(
    "accepts %s as a block",
    (id) => {
      expect(blockIdSchema.safeParse(id).success).toBe(true);
    },
  );

  it.each(["stone", "Minecraft:Stone", "minecraft:", ":stone", "minecraft:some block"])(
    "rejects %s",
    (id) => {
      expect(blockIdSchema.safeParse(id).success).toBe(false);
    },
  );
});

describe("block state", () => {
  it("accepts the property types turtle.inspect produces", () => {
    const state = { facing: "north", level: 7, waterlogged: false };
    expect(blockStateSchema.parse(state)).toEqual(state);
  });

  it("rejects nested values", () => {
    expect(blockStateSchema.safeParse({ nested: { a: 1 } }).success).toBe(false);
  });
});

describe("block type", () => {
  it("carries tags, including ones with a path", () => {
    const type = { id: "minecraft:stone", tags: ["minecraft:mineable/pickaxe", "forge:stone"] };
    expect(blockTypeSchema.safeParse(type).success).toBe(true);
    expect(blockTypeSchema.safeParse({ id: "minecraft:air", tags: [] }).success).toBe(true);
  });

  it("rejects tags that are not namespaced", () => {
    expect(blockTypeSchema.safeParse({ id: "minecraft:stone", tags: ["stone"] }).success).toBe(
      false,
    );
  });
});

describe("positions", () => {
  it("requires integer coordinates", () => {
    expect(positionSchema.safeParse({ x: 1, y: 64, z: -3 }).success).toBe(true);
    expect(positionSchema.safeParse({ x: 1.5, y: 64, z: -3 }).success).toBe(false);
  });

  it("rejects coordinates past the world border", () => {
    expect(positionSchema.safeParse({ x: 30_000_001, y: 0, z: 0 }).success).toBe(false);
  });
});

describe("sectionOf", () => {
  it("floors positive coordinates", () => {
    expect(sectionOf({ x: 0, y: 15, z: 16 })).toEqual({ sx: 0, sy: 0, sz: 1 });
    expect(sectionOf({ x: 31, y: 32, z: 33 })).toEqual({ sx: 1, sy: 2, sz: 2 });
  });

  it("floors negative coordinates into the cube below zero", () => {
    expect(sectionOf({ x: -1, y: -16, z: -17 })).toEqual({ sx: -1, sy: -1, sz: -2 });
  });

  it("uses 16-block sections", () => {
    expect(SECTION_SIZE).toBe(16);
  });
});
