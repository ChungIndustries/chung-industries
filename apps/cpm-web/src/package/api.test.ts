import { describe, expect, it } from "vitest";

import { RegistryError, unwrapJSend } from "@/package/api";

describe("unwrapJSend", () => {
  it("returns the data of a success envelope", () => {
    expect(unwrapJSend({ status: "success", data: { packages: [] } })).toEqual({ packages: [] });
  });

  it("throws the fail message", () => {
    expect(() => unwrapJSend({ status: "fail", data: { message: "Invalid version" } })).toThrow(
      new RegistryError("Invalid version"),
    );
  });

  it("throws the error message", () => {
    expect(() => unwrapJSend({ status: "error", message: "Internal Server Error" })).toThrow(
      new RegistryError("Internal Server Error"),
    );
  });
});
