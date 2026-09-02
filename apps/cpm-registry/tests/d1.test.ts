import { describe, expect, it } from "vitest";

import { likePattern } from "@/components/package/store/d1";

describe("likePattern", () => {
  it("escapes LIKE wildcards so a user's needle matches literally", () => {
    // `50%_off\` -> `50\%\_off\\`
    expect(likePattern("50%_off\\")).toBe("50\\%\\_off\\\\");
  });

  it("leaves ordinary text alone", () => {
    expect(likePattern("cc-http")).toBe("cc-http");
  });
});
