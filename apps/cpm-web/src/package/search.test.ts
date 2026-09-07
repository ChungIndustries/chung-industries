import { describe, expect, it } from "vitest";

import {
  formatBytes,
  formatTimeAgo,
  nextPageOffset,
  sortVersionsDesc,
  tagsFor,
} from "@/package/search";

describe("nextPageOffset", () => {
  it("advances by the page size while matches remain", () => {
    expect(nextPageOffset(0, 20, 45)).toBe(20);
    expect(nextPageOffset(20, 20, 45)).toBe(40);
  });

  it("stops once the total is shown, including an exact final page", () => {
    expect(nextPageOffset(40, 5, 45)).toBeUndefined();
    expect(nextPageOffset(0, 20, 20)).toBeUndefined();
    expect(nextPageOffset(0, 3, 3)).toBeUndefined();
  });

  it("never loops on an empty page", () => {
    expect(nextPageOffset(20, 0, 45)).toBeUndefined();
  });
});

describe("sortVersionsDesc", () => {
  it("orders by semver, not lexicographically", () => {
    expect(sortVersionsDesc(["1.2.0", "0.9.0", "1.10.0", "1.2.0-rc.1"])).toEqual([
      "1.10.0",
      "1.2.0",
      "1.2.0-rc.1",
      "0.9.0",
    ]);
  });
});

describe("tagsFor", () => {
  const distTags = { latest: "1.2.0", beta: "2.0.0-beta.1", stable: "1.2.0", alpha: "1.2.0" };

  it("returns the tags pointing at the version, latest first", () => {
    expect(tagsFor(distTags, "1.2.0")).toEqual(["latest", "alpha", "stable"]);
  });

  it("returns nothing for an untagged version", () => {
    expect(tagsFor(distTags, "0.1.0")).toEqual([]);
  });
});

describe("formatTimeAgo", () => {
  const now = Date.parse("2026-09-01T12:00:00.000Z");
  const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString();

  it("picks the largest whole unit, npm style", () => {
    expect(formatTimeAgo(ago(30), now)).toBe("just now");
    expect(formatTimeAgo(ago(90), now)).toBe("1 minute ago");
    expect(formatTimeAgo(ago(5 * 3600), now)).toBe("5 hours ago");
    expect(formatTimeAgo(ago(3 * 24 * 3600), now)).toBe("3 days ago");
    expect(formatTimeAgo(ago(70 * 24 * 3600), now)).toBe("2 months ago");
    expect(formatTimeAgo(ago(800 * 24 * 3600), now)).toBe("2 years ago");
  });

  it("never renders a future publish date (clock skew) as upcoming", () => {
    expect(formatTimeAgo(ago(-120), now)).toBe("just now");
  });
});

describe("formatBytes", () => {
  it("formats each unit", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(4096)).toBe("4.0 KiB");
    expect(formatBytes(1024 * 1024 * 2.5)).toBe("2.5 MiB");
  });
});
