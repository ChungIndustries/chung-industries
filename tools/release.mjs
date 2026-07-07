#!/usr/bin/env node
// Release orchestration for the two-phase release-PR flow, built on the official
// nx release programmatic API, which is nx's recommended way to customize the
// release process (https://nx.dev/docs/guides/nx-release/programmatic-api).
//
// Commands:
//
//   prepare [--dry-run] [--verbose]
//     Apply all pending version plans to the working tree: version bumps,
//     per-project changelogs, and deletion of the consumed plans. Leaves the
//     changes uncommitted for release-pr.yml's create-pull-request step to commit
//     and open the PR; never tags. `pnpm release` runs it with --dry-run to preview
//     the next release locally.
//
//   tag [--dry-run] [--verbose]
//     Run on main right after the release PR merges (release.yml). Detects the
//     released projects by diffing package.json versions between HEAD^1 and
//     HEAD (the release PR is force-rebuilt from main and always merges as
//     exactly one commit), creates the {projectName}@{version} tag for each,
//     and pushes the tags. Uses only git and node builtins so CI can run it
//     without installing dependencies.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    "dry-run": { type: "boolean", default: false },
    verbose: { type: "boolean", default: false },
  },
});

const dryRun = values["dry-run"];
const verbose = values.verbose;

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

async function prepare() {
  // Imported lazily so `tag` works without node_modules installed.
  const { releaseVersion, releaseChangelog } = await import("nx/release");

  // Run nx's version and changelog phases but let neither commit, tag, or push:
  // versioning bumps package.json files, the changelog phase writes per-project
  // changelogs and deletes the consumed version plans from disk. The caller
  // (create-pull-request) commits the resulting working-tree changes. Tagging is
  // deferred to `tag`, after the release PR merges.
  const { workspaceVersion, projectsVersionData, releaseGraph } = await releaseVersion({
    stageChanges: false,
    gitCommit: false,
    gitTag: false,
    deleteVersionPlans: false,
    dryRun,
    verbose,
  });

  const released = Object.entries(projectsVersionData).filter(
    ([, data]) => data.newVersion !== null,
  );
  if (released.length === 0) {
    console.log("No version plans resolved to a version bump; nothing to release.");
    return;
  }

  await releaseChangelog({
    releaseGraph,
    versionData: projectsVersionData,
    version: workspaceVersion,
    stageChanges: false,
    gitCommit: false,
    gitTag: false,
    gitPush: false,
    deleteVersionPlans: true,
    dryRun,
    verbose,
  });

  console.log(dryRun ? "Would release:" : "Assembled release changes for:");
  for (const [project, data] of released) {
    console.log(`  ${project}: ${data.currentVersion} -> ${data.newVersion}`);
  }
}

function showJson(ref, path) {
  try {
    return JSON.parse(git("show", `${ref}:${path}`));
  } catch {
    return null;
  }
}

function tagReleasedProjects() {
  const release = JSON.parse(readFileSync("nx.json", "utf8")).release ?? {};
  const tagPattern = release.releaseTag?.pattern ?? "v{version}";

  const changedFiles = git("diff", "--name-only", "HEAD^1", "HEAD")
    .split("\n")
    .filter((file) => file === "package.json" || file.endsWith("/package.json"));

  // A version field only changes here when nx released the project (prepare is the
  // only thing that mutates versions), so a changed version means a release, dependents
  // nx auto-bumped included. This mirrors nx's own tag set without reimplementing its
  // project matching, and cannot silently drop a tag the way a pattern filter could.
  const tags = [];
  for (const file of changedFiles) {
    const current = showJson("HEAD", file);
    const previous = showJson("HEAD^1", file);
    if (!current?.name || !current?.version) continue;
    if (previous?.version === current.version) {
      if (verbose) console.log(`${file}: version unchanged, skipping`);
      continue;
    }
    const tag = tagPattern
      .replaceAll("{projectName}", current.name)
      .replaceAll("{version}", current.version);
    let exists = true;
    try {
      git("rev-parse", "-q", "--verify", `refs/tags/${tag}`);
    } catch {
      exists = false;
    }
    if (exists) {
      console.log(`Tag ${tag} already exists, skipping.`);
      continue;
    }
    tags.push(tag);
  }

  if (tags.length === 0) {
    console.log("No released projects detected in the merge commit; nothing to tag.");
    return;
  }

  for (const tag of tags) {
    if (dryRun) {
      console.log(`Would create tag ${tag}`);
    } else {
      git("tag", "-a", tag, "-m", tag);
      console.log(`Created tag ${tag}`);
    }
  }
  if (dryRun) {
    console.log("Would push tags to origin.");
  } else {
    git("push", "origin", ...tags.map((tag) => `refs/tags/${tag}`));
    console.log("Pushed tags to origin.");
  }
}

const [command] = positionals;
if (command === "prepare") {
  await prepare();
} else if (command === "tag") {
  tagReleasedProjects();
} else {
  console.error("Usage: node tools/release.mjs <prepare|tag> [--dry-run] [--verbose]");
  process.exit(1);
}
