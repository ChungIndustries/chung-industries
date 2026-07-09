import { describe, expect, it } from "vitest";

import { pickLatest } from "@/components/package/version";

describe("pickLatest", () => {
  it("selects the highest stable release", () => {
    expect(pickLatest(["1.0.0", "1.2.0", "1.1.0"])).toBe("1.2.0");
    expect(pickLatest(["2.0.0", "10.0.0", "9.9.9"])).toBe("10.0.0");
  });

  it("ignores prereleases while a stable release exists", () => {
    expect(pickLatest(["1.2.0", "2.0.0-beta.1", "1.1.0"])).toBe("1.2.0");
  });

  it("falls back to the highest prerelease when no stable release exists", () => {
    expect(pickLatest(["1.0.0-alpha", "1.0.0-beta", "1.0.0-rc.1"])).toBe("1.0.0-rc.1");
  });
});
