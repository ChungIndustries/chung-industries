import { describe, expect, it } from "vitest";

import { HANDLE_PATTERN, pickHandle } from "@/components/auth/handle";

describe("HANDLE_PATTERN", () => {
  it("accepts GitHub logins", () => {
    for (const login of ["octocat", "a", "Other-Dev", "user-1-2", "a".repeat(39)]) {
      expect(login).toMatch(HANDLE_PATTERN);
    }
  });

  it("rejects what GitHub rejects", () => {
    for (const login of ["", "-octocat", "octocat-", "octo--cat", "octo_cat", "a".repeat(40)]) {
      expect(login).not.toMatch(HANDLE_PATTERN);
    }
  });
});

describe("pickHandle", () => {
  const taken =
    (...handles: string[]) =>
    async (handle: string) =>
      handles.includes(handle);

  it("uses the login itself when it is free", async () => {
    expect(await pickHandle("octocat", taken())).toBe("octocat");
  });

  it("suffixes a taken login with the first free number from 2", async () => {
    expect(await pickHandle("octocat", taken("octocat"))).toBe("octocat-2");
    expect(await pickHandle("octocat", taken("octocat", "octocat-2"))).toBe("octocat-3");
  });
});
