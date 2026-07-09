#!/usr/bin/env node
// Release orchestration for the two-phase release-PR flow, built on the official
// nx release programmatic API, which is nx's recommended way to customize the
// release process (https://nx.dev/docs/guides/nx-release/programmatic-api).
//
// Commands:
//
//   prepare [--dry-run] [--verbose] [--pr-body <path>]
//     Apply all pending version plans to the working tree: version bumps,
//     per-project changelogs, and deletion of the consumed plans. Leaves the
//     changes uncommitted for release-pr.yml's create-pull-request step to commit
//     and open the PR; never tags. With --pr-body, also writes the release PR body
//     (intro + each project's changelog inline) to <path>, which must sit OUTSIDE
//     the repo so create-pull-request does not commit it. `pnpm release` runs it
//     with --dry-run to preview the next release locally.
//
//   tag [--dry-run] [--verbose]
//     Run on main right after the release PR merges (release.yml). Detects the
//     released projects by diffing package.json versions between HEAD^1 and
//     HEAD (the release PR is force-rebuilt from main and always merges as
//     exactly one commit), creates the {projectName}@{version} tag for each,
//     pushes the tags, and creates a GitHub Release per tag with that version's
//     CHANGELOG.md section as the notes. Uses only git, node builtins, and the
//     gh CLI (preinstalled on runners; needs GH_TOKEN), so CI can run it
//     without installing dependencies.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    "dry-run": { type: "boolean", default: false },
    verbose: { type: "boolean", default: false },
    "pr-body": { type: "string" },
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

  const changelog = await releaseChangelog({
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

  const bodyPath = values["pr-body"];
  if (bodyPath) {
    writeFileSync(bodyPath, renderPrBody(changelog));
  }

  console.log(dryRun ? "Would release:" : "Assembled release changes for:");
  for (const [project, data] of released) {
    console.log(`  ${project}: ${data.currentVersion} -> ${data.newVersion}`);
  }
}

// Build the release PR body: an intro plus every released project's changelog
// rendered inline, so a reviewer sees exactly what will be released without opening
// the diff. nx hands back the rendered entry per project in `contents`.
function renderPrBody(changelog) {
  const intro =
    "Automated release PR, do not edit. Merging it versions, changelogs, and tags " +
    "every project with a pending version plan, then publishes. It refreshes " +
    "automatically as more plans land on `main`. Close it to defer the release.";
  const projectChangelogs = changelog?.projectChangelogs ?? {};
  const sections = Object.values(projectChangelogs).map(({ releaseVersion, contents }) => {
    const tag = releaseVersion.gitTag ?? releaseVersion.rawVersion;
    const entry = contents.trim();
    // nx renders each entry starting with "## <version> (<date>)". Relabel that
    // heading with the full tag (e.g. "## cpm-registry@0.0.1 (<date>)") so each
    // section names its project; fall back to prefixing if the shape is unexpected.
    return /^## \S+/.test(entry)
      ? entry.replace(/^## \S+/, () => `## ${tag}`)
      : `## ${tag}\n\n${entry}`;
  });
  return sections.length > 0 ? `${intro}\n\n---\n\n${sections.join("\n\n")}\n` : `${intro}\n`;
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
    tags.push({
      tag,
      dir: file === "package.json" ? "." : dirname(file),
      version: current.version,
    });
  }

  if (tags.length === 0) {
    console.log("No released projects detected in the merge commit; nothing to tag.");
    return;
  }

  for (const { tag } of tags) {
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
    git("push", "origin", ...tags.map(({ tag }) => `refs/tags/${tag}`));
    console.log("Pushed tags to origin.");
  }

  // A GitHub Release per tag, with that version's changelog section as notes.
  // Piggybacks on the tag-exists skip above, so re-running a completed release
  // stays a no-op.
  for (const { tag, dir, version } of tags) {
    const notes = changelogSection(dir, version) ?? `See ${dir}/CHANGELOG.md.`;
    if (dryRun) {
      console.log(`Would create GitHub release ${tag}`);
      continue;
    }
    execFileSync(
      "gh",
      ["release", "create", tag, "--verify-tag", "--title", tag, "--notes", notes],
      {
        stdio: "inherit",
      },
    );
    console.log(`Created GitHub release ${tag}`);
  }
}

// The section for one version in a project's CHANGELOG.md: from its "## <version>"
// heading (nx renders "## <version> (<date>)") up to the next release heading.
function changelogSection(projectDir, version) {
  let changelog;
  try {
    changelog = readFileSync(join(projectDir, "CHANGELOG.md"), "utf8");
  } catch {
    return null;
  }
  const lines = changelog.split("\n");
  const start = lines.findIndex(
    (line) => line === `## ${version}` || line.startsWith(`## ${version} `),
  );
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const next = rest.findIndex((line) => line.startsWith("## "));
  const body = (next === -1 ? rest : rest.slice(0, next)).join("\n").trim();
  return body || null;
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
