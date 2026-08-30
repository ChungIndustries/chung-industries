import semver from "semver";

import type { Package } from "@/package/schemas";

/**
 * Interim client-side search: the index page loads the full package list and
 * filters it here. Once the registry grows a real search endpoint (issue #85,
 * `GET /search?q=...`), this filter should be replaced by a call to it, and
 * extended to descriptions when the manifest grows one.
 */
export function searchPackages(packages: Package[], query: string): Package[] {
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? packages.filter(
        (pkg) =>
          pkg.name.toLowerCase().includes(needle) ||
          (pkg.author?.toLowerCase().includes(needle) ?? false),
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

/** Human-readable byte size, binary units, one decimal above bytes. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib.toFixed(1)} KiB`;
  return `${(kib / 1024).toFixed(1)} MiB`;
}
