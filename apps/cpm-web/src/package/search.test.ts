import { describe, expect, it } from "vitest";

import type { Package } from "@/package/schemas";
import {
  formatBytes,
  formatTimeAgo,
  searchPackages,
  sortVersionsDesc,
  tagsFor,
} from "@/package/search";

function pkg(name: string, author?: string, description?: string): Package {
  const dist = {
    tarball: { url: "", shasum: "", integrity: "" },
    bundle: { url: "", sha256: "", size: 0 },
  };
  return {
    name,
    author,
    "dist-tags": { latest: "1.0.0" },
    versions: { "1.0.0": { name, version: "1.0.0", description, dist } },
  };
}

describe("searchPackages", () => {
  const packages = [
    pkg("zeta"),
    pkg("cc-http", "chungindustries"),
    pkg("mail", "alice", "Send letters between computers"),
  ];

  it("returns everything alphabetically for an empty query", () => {
    expect(searchPackages(packages, "").map((p) => p.name)).toEqual(["cc-http", "mail", "zeta"]);
  });

  it("matches name substrings case-insensitively", () => {
    expect(searchPackages(packages, "HTTP").map((p) => p.name)).toEqual(["cc-http"]);
  });

  it("matches author substrings", () => {
    expect(searchPackages(packages, "alice").map((p) => p.name)).toEqual(["mail"]);
  });

  it("matches the latest version's description", () => {
    expect(searchPackages(packages, "letters").map((p) => p.name)).toEqual(["mail"]);
  });

  it("trims the query", () => {
    expect(searchPackages(packages, "  mail  ").map((p) => p.name)).toEqual(["mail"]);
  });

  it("returns nothing for a miss", () => {
    expect(searchPackages(packages, "nope")).toEqual([]);
  });

  it("does not mutate the input order", () => {
    searchPackages(packages, "");
    expect(packages[0]!.name).toBe("zeta");
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
