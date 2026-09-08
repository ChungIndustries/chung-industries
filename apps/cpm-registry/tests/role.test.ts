import { describe, expect, it } from "vitest";

import { isAdminRole } from "@/components/auth/role";

describe("isAdminRole", () => {
  it("recognises the admin role on its own and among others", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("user,admin")).toBe(true);
    expect(isAdminRole("admin, user")).toBe(true);
  });

  it("treats the default role, an unset role, and look-alikes as not admin", () => {
    expect(isAdminRole("user")).toBe(false);
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
    expect(isAdminRole("")).toBe(false);
    expect(isAdminRole("administrator")).toBe(false);
  });
});
