import { z } from "zod";

import { turtleIdSchema } from "./turtle";
import {
  blockIdSchema,
  blockStateSchema,
  blockTypeSchema,
  dimensionIdSchema,
  mapChunkKeySchema,
  positionSchema,
} from "./world";

/** One block as a turtle saw it. Air is a valid observation. */
export const observationSchema = positionSchema.extend({
  block: blockIdSchema,
  state: blockStateSchema.optional(),
});
export type Observation = z.infer<typeof observationSchema>;

/**
 * Upper bound on a single upload. A turtle sees three blocks per move, so this
 * covers well over a minute of walking; the agent flushes long before that.
 */
export const MAX_BATCH_SIZE = 500;

/**
 * What a turtle uploads. The dimension is stated once because a turtle cannot
 * change dimension mid-batch. A batch of one is exactly what send-each mode
 * posts, so it must stay valid and cheap.
 *
 * `blockTypes` carries the tags of block ids this turtle has not reported
 * before, so a batch is self-describing without repeating tags on every
 * observation. The server upserts them; sending a type again is harmless.
 */
export const observationBatchSchema = z.object({
  dimension: dimensionIdSchema,
  observations: z.array(observationSchema).min(1).max(MAX_BATCH_SIZE),
  blockTypes: z.array(blockTypeSchema).max(MAX_BATCH_SIZE).optional(),
});
export type ObservationBatch = z.infer<typeof observationBatchSchema>;

/**
 * An observation as the map stores and serves it. `observedAt` is assigned by
 * the server on ingest; turtles never send timestamps.
 */
export const storedBlockSchema = observationSchema.extend({
  observedAt: z.iso.datetime(),
  turtleId: turtleIdSchema,
});
export type StoredBlock = z.infer<typeof storedBlockSchema>;

/** One map chunk's known blocks. Sparse: unobserved cells are simply absent. */
export const mapChunkSchema = mapChunkKeySchema.extend({
  blocks: z.array(storedBlockSchema),
});
export type MapChunk = z.infer<typeof mapChunkSchema>;
