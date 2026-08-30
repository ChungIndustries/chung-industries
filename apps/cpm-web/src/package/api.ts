import type { Package } from "@/package/types";

/**
 * Fetchers for the site's own /api routes (src/worker), which proxy the
 * registry same-origin over its service binding. Responses use the registry's
 * JSend envelope.
 */

type JSend<T> =
  | { status: "success"; data: T }
  | { status: "fail"; data: { message: string } }
  | { status: "error"; message: string };

export class RegistryError extends Error {}
export class PackageNotFoundError extends RegistryError {}

/** Unwraps a JSend envelope into its data, throwing on fail/error envelopes. */
export function unwrapJSend<T>(body: JSend<T>): T {
  if (body.status === "success") return body.data;
  throw new RegistryError(body.status === "fail" ? body.data.message : body.message);
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (response.status === 404) {
    throw new PackageNotFoundError("Package not found");
  }
  let body: JSend<T>;
  try {
    body = (await response.json()) as JSend<T>;
  } catch {
    throw new RegistryError(`The registry returned a non-JSON ${response.status}`);
  }
  return unwrapJSend(body);
}

export async function fetchPackages(): Promise<Package[]> {
  const { packages } = await getJson<{ packages: Package[] }>("/api/packages");
  return packages;
}

export async function fetchPackage(name: string): Promise<Package> {
  return getJson<Package>(`/api/packages/${encodeURIComponent(name)}`);
}

/** The package's README text, or null when the published version ships none. */
export async function fetchReadme(name: string, version: string): Promise<string | null> {
  const { readme } = await getJson<{ readme: string | null }>(
    `/api/packages/${encodeURIComponent(name)}/${encodeURIComponent(version)}/readme`,
  );
  return readme;
}
