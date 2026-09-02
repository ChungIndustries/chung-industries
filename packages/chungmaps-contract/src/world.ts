import { z } from "zod";

// Minecraft resource locations: a namespace, a colon, and a path. Both halves
// are lowercase by definition, so the regex is case-sensitive on purpose.
const NAMESPACED_ID = /^[a-z0-9_.-]+:[a-z0-9_./-]+$/;

export const dimensionIdSchema = z.string().regex(NAMESPACED_ID).meta({
  description: "Namespaced dimension id",
  example: "minecraft:overworld",
});
export type DimensionId = z.infer<typeof dimensionIdSchema>;

export const blockIdSchema = z.string().regex(NAMESPACED_ID).meta({
  description: "Namespaced block id, as returned by turtle.inspect",
  example: "minecraft:stone",
});
export type BlockId = z.infer<typeof blockIdSchema>;

/** The block id a turtle reports for an empty cell (turtle.inspect returns false there). */
export const AIR: BlockId = "minecraft:air";

// The `state` table from turtle.inspect: property values are strings, numbers,
// or booleans (facing="north", level=7, waterlogged=false).
export const blockStateSchema = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
  .meta({
    description: "Block state properties, as returned by turtle.inspect",
    example: { facing: "north", waterlogged: false },
  });
export type BlockState = z.infer<typeof blockStateSchema>;

// Vanilla's horizontal world border. Build height varies by version and mod,
// so y gets the same generous bound rather than a hardcoded -64..319.
const WORLD_LIMIT = 30_000_000;

export const coordinateSchema = z.int().min(-WORLD_LIMIT).max(WORLD_LIMIT);
export type Coordinate = z.infer<typeof coordinateSchema>;

/** Absolute world coordinates, as gps.locate reports them. */
export const positionSchema = z.object({
  x: coordinateSchema,
  y: coordinateSchema,
  z: coordinateSchema,
});
export type Position = z.infer<typeof positionSchema>;

// Minecraft's compass: north is -z, east is +x, south is +z, west is -x.
export const facingSchema = z.enum(["north", "east", "south", "west"]).meta({
  description: "Horizontal direction the turtle faces (north is -z, east is +x)",
});
export type Facing = z.infer<typeof facingSchema>;

/** Edge length of the cubic sections the map is addressed and served in. */
export const SECTION_SIZE = 16;

export const sectionCoordinateSchema = z
  .int()
  .min(Math.floor(-WORLD_LIMIT / SECTION_SIZE))
  .max(Math.floor(WORLD_LIMIT / SECTION_SIZE));

/** Addresses one 16x16x16 cube of the world. */
export const sectionKeySchema = z.object({
  dimension: dimensionIdSchema,
  sx: sectionCoordinateSchema,
  sy: sectionCoordinateSchema,
  sz: sectionCoordinateSchema,
});
export type SectionKey = z.infer<typeof sectionKeySchema>;

/** The section containing a position. Floors, so negative coordinates land in the right cube. */
export function sectionOf(position: Position): Pick<SectionKey, "sx" | "sy" | "sz"> {
  return {
    sx: Math.floor(position.x / SECTION_SIZE),
    sy: Math.floor(position.y / SECTION_SIZE),
    sz: Math.floor(position.z / SECTION_SIZE),
  };
}
