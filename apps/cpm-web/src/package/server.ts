import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { z } from "zod";

import { readReadme } from "@/package/bundle";
import { type JSend, RegistryError, unwrapJSend } from "@/package/jsend";
import { packageSchema } from "@/package/schemas";

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

/** A response that fails its schema is the registry breaking its contract. */
function parseRegistry<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new RegistryError("The registry returned an unexpected shape");
  return result.data;
}

export const fetchPackages = createServerFn({ method: "GET" }).handler(async () => {
  const data = await registryJson<unknown>("/packages");
  // /packages never 404s; a null here would be a contract violation.
  if (data === null) throw new RegistryError("Package list unavailable");
  return parseRegistry(z.object({ packages: z.array(packageSchema) }), data).packages;
});

export const fetchPackage = createServerFn({ method: "GET" })
  .validator((name: string) => name)
  .handler(async ({ data: name }) => {
    const data = await registryJson<unknown>(`/packages/${encodeURIComponent(name)}`);
    return data === null ? null : parseRegistry(packageSchema, data);
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
