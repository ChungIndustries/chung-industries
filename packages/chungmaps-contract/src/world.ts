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

// The `state` table from turtle.inspect: the block's state properties. Which
// properties exist, and which values they take, depend on the block (a
// furnace's `facing` has four values, a dispenser's six, a log has `axis`
// instead), and mods add their own, so this stays an open map rather than a
// closed set of enums. Values are strings, numbers, or booleans
// (facing="north", level=7, waterlogged=false).
export const blockStateSchema = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
  .meta({
    description: "Block state properties, as returned by turtle.inspect",
    example: { facing: "north", waterlogged: false },
  });
export type BlockState = z.infer<typeof blockStateSchema>;

export const blockTagSchema = z.string().regex(NAMESPACED_ID).meta({
  description: "Namespaced block tag",
  example: "minecraft:mineable/pickaxe",
});
export type BlockTag = z.infer<typeof blockTagSchema>;

/**
 * What is known about a kind of block regardless of where it stands. Tags come
 * from turtle.inspect as well, but they belong to the block id, not to the
 * observation, so they are reported once per id and stored once.
 */
export const blockTypeSchema = z.object({
  id: blockIdSchema,
  tags: z.array(blockTagSchema),
});
export type BlockType = z.infer<typeof blockTypeSchema>;

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

// Minecraft's compass: north is -z, east is +x, south is +z, west is -x. A
// turtle only ever faces one of these four; blocks that face up or down carry
// that in their state instead.
export const facingSchema = z.enum(["north", "east", "south", "west"]).meta({
  description: "Horizontal direction the turtle faces (north is -z, east is +x)",
});
export type Facing = z.infer<typeof facingSchema>;

/**
 * Edge length of the cubes the map is addressed and served in. A map chunk is
 * 16x16x16, deliberately not Minecraft's chunk (a 16-wide column spanning the
 * full build height), hence the distinct name.
 */
export const MAP_CHUNK_SIZE = 16;

export const mapChunkCoordinateSchema = z
  .int()
  .min(Math.floor(-WORLD_LIMIT / MAP_CHUNK_SIZE))
  .max(Math.floor(WORLD_LIMIT / MAP_CHUNK_SIZE));

/** Addresses one map chunk. */
export const mapChunkKeySchema = z.object({
  dimension: dimensionIdSchema,
  cx: mapChunkCoordinateSchema,
  cy: mapChunkCoordinateSchema,
  cz: mapChunkCoordinateSchema,
});
export type MapChunkKey = z.infer<typeof mapChunkKeySchema>;

/** The map chunk containing a position. Floors, so negative coordinates land in the right cube. */
export function mapChunkOf(position: Position): Pick<MapChunkKey, "cx" | "cy" | "cz"> {
  return {
    cx: Math.floor(position.x / MAP_CHUNK_SIZE),
    cy: Math.floor(position.y / MAP_CHUNK_SIZE),
    cz: Math.floor(position.z / MAP_CHUNK_SIZE),
  };
}
