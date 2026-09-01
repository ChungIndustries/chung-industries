import { z } from "zod";

/** The signed-in user, as Better Auth's `/auth/get-session` returns it. */
export const sessionSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    image: z.string().nullish(),
  }),
});

export type Session = z.infer<typeof sessionSchema>;

/**
 * A publish token row from `/auth/api-key/list`. The raw secret is never in
 * this shape; it exists only in the create response, shown once.
 */
export const publishTokenSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  /** First characters of the raw key (including the `cpm_` prefix). */
  start: z.string().nullable(),
  enabled: z.boolean(),
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
  lastRequest: z.string().nullable(),
});

export type PublishToken = z.infer<typeof publishTokenSchema>;

export const publishTokenListSchema = z.object({
  apiKeys: z.array(publishTokenSchema),
});

/** A package the signed-in user maintains, from the registry's `GET /me/packages`. */
export const maintainedPackagesSchema = z.object({
  packages: z.array(
    z.object({
      name: z.string(),
      role: z.enum(["owner", "maintainer"]),
    }),
  ),
});

export type MaintainedPackage = z.infer<typeof maintainedPackagesSchema>["packages"][number];

/** Expiry choices offered when minting a token; the registry caps at one year. */
export const TOKEN_EXPIRY_DAYS = [30, 90, 180, 365] as const;

export const createTokenSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the token a name")
    .max(64, "Keep the name under 64 characters"),
  expiresInDays: z.literal(TOKEN_EXPIRY_DAYS, "Pick one of the offered expiries"),
});

export type CreateTokenInput = z.infer<typeof createTokenSchema>;
