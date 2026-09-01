import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";
import type { z } from "zod";

import { maintainedPackagesSchema, publishTokenListSchema, sessionSchema } from "@/auth/schemas";
import { type JSend, RegistryError, unwrapJSend } from "@/package/jsend";

/**
 * Server functions for the auth reads the pages render with (session, token
 * inventory, maintained packages). They run on the Worker and forward the
 * caller's session cookie to the registry over the service binding, so SSR
 * sees the same session the browser holds. Mutations (sign-in, sign-out,
 * mint, revoke) go through the Better Auth client instead (see hooks.ts).
 */

// The hostname is arbitrary; service bindings route by binding, not DNS.
const REGISTRY = "https://cpm-registry";

/** The caller's cookie header, forwarded so the registry sees their session. */
function sessionHeaders(): Record<string, string> {
  const cookie = getRequestHeader("cookie");
  return cookie ? { cookie } : {};
}

/** A response that fails its schema is the registry breaking its contract. */
function parseRegistry<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new RegistryError("The registry returned an unexpected shape");
  return result.data;
}

/**
 * The signed-in user, or null. Anonymous is a normal state, not an error, so
 * any failure to resolve the session renders the site signed out rather than
 * broken.
 */
export const fetchSession = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const response = await env.REGISTRY.fetch(`${REGISTRY}/auth/get-session`, {
      headers: sessionHeaders(),
    });
    if (!response.ok) return null;
    // Better Auth answers a signed-out get-session with a literal JSON null.
    const data: unknown = await response.json();
    if (data === null) return null;
    return parseRegistry(sessionSchema, data);
  } catch {
    return null;
  }
});

export const fetchTokens = createServerFn({ method: "GET" }).handler(async () => {
  const response = await env.REGISTRY.fetch(`${REGISTRY}/auth/api-key/list`, {
    headers: sessionHeaders(),
  });
  if (!response.ok) throw new RegistryError(`Token list unavailable (${response.status})`);
  return parseRegistry(publishTokenListSchema, await response.json()).apiKeys;
});

export const fetchMyPackages = createServerFn({ method: "GET" }).handler(async () => {
  const response = await env.REGISTRY.fetch(`${REGISTRY}/me/packages`, {
    headers: sessionHeaders(),
  });
  let body: JSend<unknown>;
  try {
    body = (await response.json()) as JSend<unknown>;
  } catch {
    throw new RegistryError(`The registry returned a non-JSON ${response.status}`);
  }
  return parseRegistry(maintainedPackagesSchema, unwrapJSend(body)).packages;
});
