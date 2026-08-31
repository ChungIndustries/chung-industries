import semver from "semver";

import type { Package, PackageVersion } from "@/package/schemas";

/** The version entry `dist-tags.latest` points at: what the index rows show. */
export function latestEntry(pkg: Package): PackageVersion | undefined {
  return pkg.versions[pkg["dist-tags"].latest];
}

/**
 * Interim client-side search: the index page loads the full package list and
 * filters it here. Once the registry grows a real search endpoint (issue #85,
 * `GET /search?q=...`), this filter should be replaced by a call to it.
 */
export function searchPackages(packages: Package[], query: string): Package[] {
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? packages.filter(
        (pkg) =>
          pkg.name.toLowerCase().includes(needle) ||
          (pkg.author?.toLowerCase().includes(needle) ?? false) ||
          (latestEntry(pkg)?.description?.toLowerCase().includes(needle) ?? false),
      )
    : [...packages];
  return matches.sort((a, b) => a.name.localeCompare(b.name));
}

/** Version strings of a package, newest first. */
export function sortVersionsDesc(versions: string[]): string[] {
  return [...versions].sort(semver.rcompare);
}

/** Dist-tags pointing at `version`, `latest` first, for badge rendering. */
export function tagsFor(distTags: Record<string, string>, version: string): string[] {
  return Object.entries(distTags)
    .filter(([, target]) => target === version)
    .map(([tag]) => tag)
    .sort((a, b) => (a === "latest" ? -1 : b === "latest" ? 1 : a.localeCompare(b)));
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/**
 * npm-style relative publish time ("2 months ago"), wording delegated to
 * `Intl.RelativeTimeFormat`. `now` is injectable for tests.
 */
export function formatTimeAgo(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, (now - Date.parse(iso)) / 1000);
  const [unit, size] = RELATIVE_UNITS.find(([, size]) => seconds >= size) ?? [];
  if (!unit || !size) return "just now";
  return new Intl.RelativeTimeFormat("en", { numeric: "always" }).format(
    -Math.floor(seconds / size),
    unit,
  );
}

/** Human-readable byte size, binary units, one decimal above bytes. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib.toFixed(1)} KiB`;
  return `${(kib / 1024).toFixed(1)} MiB`;
}
