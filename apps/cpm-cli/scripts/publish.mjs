// Publishes dist/cpm-<version>.tgz to the registry as the `cpm` package.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const version = pkg.version;
const filename = `cpm-${version}.tgz`;
// No fallback URL on purpose: a publish must state its target explicitly, so a
// missing variable fails loudly instead of silently publishing somewhere stale.
// The `!` check also catches CI passing an unset repository variable through as
// an empty string.
if (!process.env.CPM_REGISTRY_URL) {
  console.error(
    "CPM_REGISTRY_URL is not set. Point it at the registry base URL " +
      "(the release workflow supplies it from the repository variable of the same name).",
  );
  process.exit(1);
}
// Publishing requires a publish-scoped registry token (created from the
// registry account page by the cpm package's owner). Same no-fallback rule.
if (!process.env.CPM_REGISTRY_TOKEN) {
  console.error(
    "CPM_REGISTRY_TOKEN is not set. Create a publish token on the registry " +
      "account page (the release workflow supplies it from the repository secret of the same name).",
  );
  process.exit(1);
}
const registry = process.env.CPM_REGISTRY_URL.replace(/\/+$/, "");
const token = process.env.CPM_REGISTRY_TOKEN;

const tarball = await readFile(join(root, "dist", filename));

// The tarball is the whole publish request: the registry reads name, version,
// and dependencies from the cpm.json the build script generated into it.
const form = new FormData();
form.append("tarball", new File([tarball], filename, { type: "application/gzip" }));

const response = await fetch(`${registry}/packages`, {
  method: "POST",
  headers: { authorization: `Bearer ${token}` },
  body: form,
});
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
