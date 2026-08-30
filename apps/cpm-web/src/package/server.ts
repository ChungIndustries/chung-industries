import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";

import { readReadme } from "@/package/bundle";
import { type JSend, RegistryError, unwrapJSend } from "@/package/jsend";
import type { Package } from "@/package/types";

/**
 * Server functions fetching registry data over the REGISTRY service binding.
 * They run on the Worker only; the client calls them as RPCs, so the registry
 * never needs public CORS and its API contract stays untouched.
 */

// The hostname is arbitrary; service bindings route by binding, not DNS.
const REGISTRY = "https://cpm-registry";

async function registryJson<T>(path: string): Promise<T | null> {
  const response = await env.REGISTRY.fetch(`${REGISTRY}${path}`);
  if (response.status === 404) return null;
  let body: JSend<T>;
  try {
    body = (await response.json()) as JSend<T>;
  } catch {
    throw new RegistryError(`The registry returned a non-JSON ${response.status}`);
  }
  return unwrapJSend(body);
}

export const fetchPackages = createServerFn({ method: "GET" }).handler(async () => {
  const data = await registryJson<{ packages: Package[] }>("/packages");
  // /packages never 404s; a null here would be a contract violation.
  if (data === null) throw new RegistryError("Package list unavailable");
  return data.packages;
});

export const fetchPackage = createServerFn({ method: "GET" })
  .validator((name: string) => name)
  .handler(async ({ data: name }) => {
    return registryJson<Package>(`/packages/${encodeURIComponent(name)}`);
  });

/** The version's README text, extracted from its published bundle artifact. */
export const fetchReadme = createServerFn({ method: "GET" })
  .validator((input: { name: string; version: string }) => input)
  .handler(async ({ data: { name, version } }) => {
    const path = `/packages/${encodeURIComponent(name)}/${encodeURIComponent(version)}/dist/bundle`;
    // No Accept-Encoding is sent, so the registry serves identity bytes.
    const response = await env.REGISTRY.fetch(`${REGISTRY}${path}`);
    if (!response.ok) return null;
    // A malformed bundle is the registry's bug, not the page's: treat it like
    // a missing README rather than a broken page.
    try {
      return readReadme(new Uint8Array(await response.arrayBuffer()));
    } catch {
      return null;
    }
  });
