// Packs src/ (the root of the published `cpm` package) into dist/cpm-<version>.tgz.
import { mkdir, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { create } from "tar";

const root = fileURLToPath(new URL("..", import.meta.url));
const src = join(root, "src");
const dist = join(root, "dist");

const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const file = join(dist, `cpm-${pkg.version}.tgz`);

await mkdir(dist, { recursive: true });

// Entries are listed by name rather than "." so archive paths come out as `bin/cpm.lua`,
// not `./bin/cpm.lua`. A fixed mtime keeps the tarball reproducible across builds.
const entries = (await readdir(src)).sort();
await create({ gzip: true, portable: true, cwd: src, file, mtime: new Date(0) }, entries);

console.log(`built ${file} (${entries.length} top-level entries)`);
