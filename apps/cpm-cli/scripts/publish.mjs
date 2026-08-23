// Publishes dist/cpm-<version>.tgz to the registry as the `cpm` package.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const version = pkg.version;
const filename = `cpm-${version}.tgz`;
const registry = (
  process.env.CPM_REGISTRY_URL ?? "https://registry.cpm.chungindustries.com"
).replace(/\/+$/, "");

const tarball = await readFile(join(root, "dist", filename));

const form = new FormData();
form.append("meta", JSON.stringify({ name: "cpm", version, author: "chungindustries" }));
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

if (!response.ok) {
  process.exitCode = 1;
}
