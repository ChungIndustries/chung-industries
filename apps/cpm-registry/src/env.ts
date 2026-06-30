import "dotenv-flow/config";
import { z } from "zod";

/**
 * Validated environment. The single source of truth for what this service
 * reads from the environment. Nothing else should touch `process.env`.
 *
 * Values are loaded by dotenv-flow from the `.env` cascade (`.env`,
 * `.env.<NODE_ENV>`, `.env.local`, `.env.<NODE_ENV>.local`), then real
 * process env takes precedence. zod supplies defaults, coercion, and
 * validation in one place.
 */
const EnvSchema = z.object({
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  STORAGE_DIR: z.string().default("storage"),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(`Invalid environment variables:\n${z.prettifyError(parsed.error)}`);
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
