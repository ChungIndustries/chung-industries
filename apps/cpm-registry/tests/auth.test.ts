import { describe, expect, it } from "vitest";

import type { Scope } from "@/components/auth/actor";
import { resolveActor, type AuthGateway } from "@/components/auth/middleware";

/** Gateway fake: one known token, one known session cookie. */
function gateway(
  overrides: Partial<Record<"token", { userId: string; scopes: Scope[] } | null>> = {},
): AuthGateway {
  return {
    async verifyToken(token) {
      if ("token" in overrides) return overrides.token ?? null;
      return token === "cpm_good" ? { userId: "user-1", scopes: ["publish"] } : null;
    },
    async sessionUser(headers) {
      return headers.get("cookie") === "session=valid" ? { userId: "user-2" } : null;
    },
  };
}

const headers = (init: Record<string, string> = {}) => new Headers(init);

describe("resolveActor", () => {
  it("returns null for an anonymous request", async () => {
    expect(await resolveActor(headers(), gateway())).toBeNull();
  });

  it("resolves a valid bearer token to a token actor", async () => {
    const actor = await resolveActor(headers({ Authorization: "Bearer cpm_good" }), gateway());
    expect(actor).toEqual({ userId: "user-1", scopes: ["publish"], via: "token" });
  });

  it("accepts a case-insensitive scheme", async () => {
    const actor = await resolveActor(headers({ Authorization: "bearer cpm_good" }), gateway());
    expect(actor?.via).toBe("token");
  });

  it("rejects unknown or revoked tokens with 401", async () => {
    await expect(
      resolveActor(headers({ Authorization: "Bearer cpm_revoked" }), gateway()),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("rejects malformed Authorization headers with 401", async () => {
    for (const value of ["cpm_good", "Basic dXNlcjpwdw==", "Bearer", "Bearer a b"]) {
      await expect(
        resolveActor(headers({ Authorization: value }), gateway()),
      ).rejects.toMatchObject({ status: 401 });
    }
  });

  it("never falls back to the session when a bad bearer token is present", async () => {
    // A revoked token plus a valid cookie must fail, not silently downgrade.
    await expect(
      resolveActor(
        headers({ Authorization: "Bearer cpm_revoked", Cookie: "session=valid" }),
        gateway(),
      ),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("resolves a browser session when no token is supplied", async () => {
    const actor = await resolveActor(headers({ Cookie: "session=valid" }), gateway());
    expect(actor).toEqual({ userId: "user-2", scopes: ["publish", "manage"], via: "session" });
  });
});
