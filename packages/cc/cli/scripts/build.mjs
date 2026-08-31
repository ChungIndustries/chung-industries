// Packs src/ (the root of the published `cli` package) into dist/cli-<version>.tgz,
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
const file = join(dist, `cli-${pkg.version}.tgz`);

// cpm.json is generated rather than committed so the version has a single
// source of truth: package.json, which `nx release` bumps.
const manifest = { name: "cli", version: pkg.version, author: "chungindustries" };

await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
await cp(src, stage, { recursive: true });
await writeFile(join(stage, "cpm.json"), `${JSON.stringify(manifest, null, 2)}\n`);

// Entries are listed by name rather than "." so archive paths come out as `init.lua`,
// not `./init.lua`. A fixed mtime keeps the tarball reproducible across builds.
const entries = (await readdir(stage)).sort();
await create({ gzip: true, portable: true, cwd: stage, file, mtime: new Date(0) }, entries);

console.log(`built ${file} (${entries.length} top-level entries)`);
