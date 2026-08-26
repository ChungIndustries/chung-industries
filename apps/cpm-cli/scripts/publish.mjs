// Publishes dist/cpm-<version>.tgz to the registry as the `cpm` package.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const version = pkg.version;
const filename = `cpm-${version}.tgz`;
// `||` rather than `??`: CI passes the variable through unconditionally, so an
// unset repository variable arrives as an empty string.
const registry = (
  process.env.CPM_REGISTRY_URL || "https://registry.cpm.chungindustries.com"
).replace(/\/+$/, "");

const tarball = await readFile(join(root, "dist", filename));

// The tarball is the whole publish request: the registry reads name, version,
// and dependencies from the cpm.json the build script generated into it.
const form = new FormData();
form.append("tarball", new File([tarball], filename, { type: "application/gzip" }));

const response = await fetch(`${registry}/packages`, { method: "POST", body: form });
const text = await response.text();

let body = text;
try {
  body = JSON.stringify(JSON.parse(text), null, 2);
} catch {
  // Not JSON: print the raw body as-is.
}
console.log(`${response.status} ${response.statusText}\n${body}`);

// Published versions are immutable, so a 409 means this version is already up:
// the expected outcome when a release publish is re-run, not a failure.
if (response.status === 409) {
  console.log(`cpm@${version} is already published; nothing to do.`);
} else if (!response.ok) {
  process.exitCode = 1;
}
