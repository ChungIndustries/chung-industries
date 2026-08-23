import semver from "semver";

import type { Package, PackageVersion } from "@/components/package/schemas";
import { BadRequestError, NotFoundError } from "@/errors";

/**
 * Resolves a set of root dependencies into one pinned version per package.
 *
 * Resolution lives on the registry rather than in the Lua client so the canonical
 * `semver` package owns range semantics and the client needs no semver logic at
 * all. The client installs into a flat, single-version-per-package store (a CC
 * computer has ~1 MB of disk), so every requester of a package must agree on one
 * version: we pick the highest version satisfying the intersection of all ranges
 * requested for it and fail on conflict.
 */

/** Bounds the fixed-point loop; real dependency graphs converge in a handful of passes. */
const MAX_PASSES = 50;

type Loader = (name: string) => Promise<Package | null>;

export async function resolveDependencies(
  roots: Record<string, string>,
  load: Loader,
): Promise<PackageVersion[]> {
  const cache = new Map<string, Package>();
  const getPackage = async (name: string): Promise<Package> => {
    const cached = cache.get(name);
    if (cached) return cached;
    const pkg = await load(name);
    if (!pkg) throw new NotFoundError(`Package "${name}" not found`);
    cache.set(name, pkg);
    return pkg;
  };

  // Narrowing a package's version changes which dependencies (and ranges) it
  // contributes, so the requested-range sets are rebuilt from scratch every
  // pass from the roots plus the currently pinned set, until nothing moves.
  let pinned = new Map<string, PackageVersion>();
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const requested = new Map<string, Set<string>>();
    const request = (name: string, spec: string) => {
      const specs = requested.get(name) ?? new Set<string>();
      specs.add(spec);
      requested.set(name, specs);
    };
    for (const [name, spec] of Object.entries(roots)) request(name, spec);
    for (const entry of pinned.values()) {
      for (const [name, range] of Object.entries(entry.dependencies ?? {})) request(name, range);
    }

    const next = new Map<string, PackageVersion>();
    for (const [name, specs] of requested) {
      next.set(name, pick(await getPackage(name), [...specs]));
    }

    if (samePins(pinned, next)) return order(roots, next);
    pinned = next;
  }
  throw new BadRequestError("Dependency resolution did not converge");
}

/** Picks the highest version of `pkg` satisfying every spec (ranges or dist-tags). */
function pick(pkg: Package, specs: string[]): PackageVersion {
  const ranges = specs.map((spec) => toRange(pkg, spec));
  const versions = Object.keys(pkg.versions);
  const candidates = versions.filter((v) => ranges.every((range) => semver.satisfies(v, range)));
  const chosen = semver.rsort(candidates)[0];
  if (chosen === undefined) {
    throw new BadRequestError(
      `No version of "${pkg.name}" satisfies ${specs.map((s) => `"${s}"`).join(", ")}`,
    );
  }
  return pkg.versions[chosen]!;
}

/** A spec is a semver range, or a dist-tag that resolves to an exact version. */
function toRange(pkg: Package, spec: string): string {
  const tagged = pkg["dist-tags"][spec];
  if (tagged !== undefined) return tagged;
  if (semver.validRange(spec) !== null) return spec;
  throw new BadRequestError(`"${spec}" is not a valid version range or dist-tag of "${pkg.name}"`);
}

function samePins(a: Map<string, PackageVersion>, b: Map<string, PackageVersion>): boolean {
  if (a.size !== b.size) return false;
  for (const [name, entry] of a) {
    if (b.get(name)?.version !== entry.version) return false;
  }
  return true;
}

/** Dependencies before dependents (DFS post-order from the roots), so a client can install in sequence. */
function order(
  roots: Record<string, string>,
  pinned: Map<string, PackageVersion>,
): PackageVersion[] {
  const out: PackageVersion[] = [];
  const visited = new Set<string>();
  const visit = (name: string) => {
    if (visited.has(name)) return;
    visited.add(name);
    const entry = pinned.get(name)!;
    for (const dep of Object.keys(entry.dependencies ?? {})) visit(dep);
    out.push(entry);
  };
  for (const name of Object.keys(roots)) visit(name);
  return out;
}
