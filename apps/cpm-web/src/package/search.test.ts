import { describe, expect, it } from "vitest";

import { formatBytes, searchPackages, sortVersionsDesc, tagsFor } from "@/package/search";
import type { Package } from "@/package/types";

function pkg(name: string, author?: string): Package {
  return { name, author, "dist-tags": { latest: "1.0.0" }, versions: {} };
}

describe("searchPackages", () => {
  const packages = [pkg("zeta"), pkg("cc-http", "chungindustries"), pkg("mail", "alice")];

  it("returns everything alphabetically for an empty query", () => {
    expect(searchPackages(packages, "").map((p) => p.name)).toEqual(["cc-http", "mail", "zeta"]);
  });

  it("matches name substrings case-insensitively", () => {
    expect(searchPackages(packages, "HTTP").map((p) => p.name)).toEqual(["cc-http"]);
  });

  it("matches author substrings", () => {
    expect(searchPackages(packages, "alice").map((p) => p.name)).toEqual(["mail"]);
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

describe("formatBytes", () => {
  it("formats each unit", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(4096)).toBe("4.0 KiB");
    expect(formatBytes(1024 * 1024 * 2.5)).toBe("2.5 MiB");
  });
});
