import semver from "semver";

/**
 * Picks the version that should be tagged `latest`: the highest stable release,
 * falling back to the highest prerelease when no stable release exists yet. This
 * mirrors how npm assigns the `latest` dist-tag. Semver precedence is delegated
 * entirely to the `semver` package.
 */
export function pickLatest(versions: string[]): string {
  // A `*` range excludes prereleases by default, so this is the highest stable release.
  const stable = semver.maxSatisfying(versions, "*");
  if (stable) return stable;

  const [highest] = semver.rsort([...versions]);
  if (highest === undefined) {
    throw new Error("pickLatest requires at least one version");
  }
  return highest;
}
