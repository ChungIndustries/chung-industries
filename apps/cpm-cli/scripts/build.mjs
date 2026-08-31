// Packs src/ (the root of the published `cpm` package) into dist/cpm-<version>.tgz,
// adding the generated cpm.json manifest the registry requires at the package root.
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { create } from "tar";

const root = fileURLToPath(new URL("..", import.meta.url));
const src = join(root, "src");
const dist = join(root, "dist");
const stage = join(dist, "package");

const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const file = join(dist, `cpm-${pkg.version}.tgz`);

// The cli dependency range tracks the workspace version of packages/cli, so a
// released cpm always requires the cli it was built and released against.
const cliPkg = JSON.parse(
  await readFile(join(root, "..", "..", "packages", "cc", "cli", "package.json"), "utf8"),
);

// cpm.json is generated rather than committed so the versions and description
// have a single source of truth: the package.json files, which `nx release`
// bumps and repo readers see first.
const manifest = {
  name: "cpm",
  version: pkg.version,
  description: pkg.description,
  author: "chungindustries",
  dependencies: { cli: `^${cliPkg.version}` },
};

await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
await cp(src, stage, { recursive: true });
await writeFile(join(stage, "cpm.json"), `${JSON.stringify(manifest, null, 2)}\n`);

// Entries are listed by name rather than "." so archive paths come out as `bin/cpm.lua`,
// not `./bin/cpm.lua`. A fixed mtime keeps the tarball reproducible across builds.
const entries = (await readdir(stage)).sort();
await create({ gzip: true, portable: true, cwd: stage, file, mtime: new Date(0) }, entries);

console.log(`built ${file} (${entries.length} top-level entries)`);
