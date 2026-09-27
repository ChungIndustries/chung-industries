import { describe, expect, it } from "vitest";

import type { Scope } from "@/components/auth/actor";
import { resolveActor, type AuthGateway } from "@/components/auth/middleware";

const goodToken = { name: "laptop", expiresAt: "2026-12-01T00:00:00.000Z" };

/**
 * Gateway fake: one known token (its stored scopes overridable), one known
 * session cookie, one admin cookie.
 */
function gateway(overrides: { tokenScopes?: Scope[] } = {}): AuthGateway {
  return {
    async verifyToken(token) {
      return token === "cpm_good"
        ? {
            userId: "user-1",
            name: "Alice",
            scopes: overrides.tokenScopes ?? ["publish"],
            token: goodToken,
          }
        : null;
    },
    async sessionUser(headers) {
      switch (headers.get("cookie")) {
        case "session=valid":
          return { userId: "user-2", name: "Bob", admin: false };
        case "session=admin":
          return { userId: "user-3", name: "Carol", admin: true };
        default:
          return null;
      }
    },
  };
}

const headers = (init: Record<string, string> = {}) => new Headers(init);

describe("resolveActor", () => {
  it("returns null for an anonymous request", async () => {
    expect(await resolveActor(headers(), gateway())).toBeNull();
  });

  it("resolves a valid bearer token to a token actor carrying the token's details", async () => {
    const actor = await resolveActor(headers({ Authorization: "Bearer cpm_good" }), gateway());
    expect(actor).toEqual({
      userId: "user-1",
      name: "Alice",
      scopes: ["publish"],
      via: "token",
      token: goodToken,
    });
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

  it("resolves a browser session to a session actor with no token details", async () => {
    const actor = await resolveActor(headers({ Cookie: "session=valid" }), gateway());
    expect(actor).toEqual({
      userId: "user-2",
      name: "Bob",
      scopes: ["publish", "manage"],
      via: "session",
    });
    expect(actor).not.toHaveProperty("token");
  });

  it("caps a token at publish, whatever permissions it was minted with", async () => {
    // manage and admin are session-only; a leaked CI token must never be
    // able to change maintainers, even if its stored permissions say so.
    const actor = await resolveActor(
      headers({ Authorization: "Bearer cpm_good" }),
      gateway({ tokenScopes: ["publish", "manage", "admin"] }),
    );
    expect(actor).toEqual({
      userId: "user-1",
      name: "Alice",
      scopes: ["publish"],
      via: "token",
      token: goodToken,
    });
  });

  it("grants admin only to the session of an admin user", async () => {
    const actor = await resolveActor(headers({ Cookie: "session=admin" }), gateway());
    expect(actor).toEqual({
      userId: "user-3",
      name: "Carol",
      scopes: ["publish", "manage", "admin"],
      via: "session",
    });
  });
});
