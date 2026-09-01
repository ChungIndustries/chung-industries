import { describe, expect, it } from "vitest";

import { toRegistryAuthRequest } from "@/auth/proxy";

describe("toRegistryAuthRequest", () => {
  it("rewrites only the origin, keeping path and query", async () => {
    const proxied = await toRegistryAuthRequest(
      new Request("https://cpm.chungindustries.com/auth/callback/github?code=abc&state=xyz"),
    );
    expect(proxied.url).toBe("https://cpm-registry/auth/callback/github?code=abc&state=xyz");
    expect(proxied.method).toBe("GET");
  });

  it("keeps the method, headers, and body of a POST", async () => {
    const proxied = await toRegistryAuthRequest(
      new Request("https://cpm.chungindustries.com/auth/sign-in/social", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: "better-auth.state=s1" },
        body: JSON.stringify({ provider: "github" }),
      }),
    );
    expect(proxied.method).toBe("POST");
    expect(proxied.headers.get("content-type")).toBe("application/json");
    expect(proxied.headers.get("cookie")).toBe("better-auth.state=s1");
    await expect(proxied.json()).resolves.toEqual({ provider: "github" });
  });

  it("never follows redirects, so OAuth 302s reach the browser", async () => {
    const proxied = await toRegistryAuthRequest(
      new Request("https://cpm.chungindustries.com/auth/sign-in/social", { method: "POST" }),
    );
    expect(proxied.redirect).toBe("manual");
  });
});
