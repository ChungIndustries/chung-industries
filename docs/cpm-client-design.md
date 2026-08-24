# cpm Client Design

Status: implemented (registry in `apps/cpm-registry`, client in `apps/cpm-cli`); kept as the design record
Date: 2026-07-28
Scope: the `cpm` Lua program that runs inside Minecraft on CC:Tweaked computers and installs packages from the CPM registry (`apps/cpm-registry`, contract in [openapi.yaml](../apps/cpm-registry/openapi.yaml)).

This document records the constraints research, the design decisions, and the registry API changes those decisions imply. Registry changes are listed as explicit follow-up work items in section 10.

---

## 1. Runtime constraints (CC:Tweaked)

Facts verified against the official docs ([tweaked.cc](https://tweaked.cc)) and the CC:Tweaked source (mc-1.20.x branch). These bound every decision below.

### 1.1 The `http` API

- `http.get` / `http.post` / `http.request` support an options table: `{ url, body, headers, binary, method, redirect, timeout }`. Custom headers, HTTPS, and redirect-following all work. ([docs](https://tweaked.cc/module/http.html))
- **Binary responses are supported**: pass `binary = true` and `response.readAll()` returns raw bytes. Pair with `fs.open(path, "wb")` to write them to disk.
- **Transparent wire decompression**: the Java HTTP client's Netty pipeline includes `HttpContentDecompressor` ([HttpRequest.java](https://github.com/cc-tweaked/CC-Tweaked/blob/mc-1.20.x/projects/core/src/main/java/dan200/computercraft/core/apis/http/request/HttpRequest.java)), so a response with `Content-Encoding: gzip` is decompressed at Java speed before Lua ever sees the body. CC does not send `Accept-Encoding` by default; the client must set that header itself. This is the single most important finding: **compression on the wire is free, compression in the artifact is expensive**.
- HTTP requests run asynchronously in Java; Lua only pays for reading the result. Up to `http.max_requests = 16` concurrent requests per computer (default). Modern multi-file installers exploit this with concurrent fan-out, most commonly via `parallel.waitForAll` (verified in the artist installer, one task per file, and Opus's `bulkget.lua`, a 5-worker pool; gitget achieves the same with raw `http.request` plus an event loop, while the older packman downloads sequentially).

### 1.2 Server config limits (`http.rules`)

Server admins configure HTTP access in `serverconfig/computercraft-server.toml`. Defaults ([AddressRuleConfig.java](https://github.com/cc-tweaked/CC-Tweaked/blob/mc-1.20.x/projects/common/src/main/java/dan200/computercraft/shared/config/AddressRuleConfig.java), [guide](https://tweaked.cc/guide/local_ips.html)):

| Setting                                        | Default                                                               |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| Allowlist                                      | deny `$private` (LAN/localhost), then allow `*` (all public internet) |
| `max_download` per response                    | 16 MiB                                                                |
| `max_upload` per request body                  | 4 MiB                                                                 |
| `timeout`                                      | 30 s                                                                  |
| `http.max_requests` (concurrent, per computer) | 16                                                                    |

Consequences:

- The registry at `https://registry.cpm.chungindustries.com` is reachable from any default-configured server or singleplayer world with **zero admin action**. Only self-hosted LAN registries would need `http.rules` edits.
- A package download must fit in 16 MiB, but the real budget is disk: the default computer drive is **1,000,000 bytes (~1 MB)** total (`computer_space_limit`). Packages must be small; the client should check `fs.getFreeSpace` before writing.

### 1.3 What CC:Tweaked does NOT provide

- No built-in compression (gzip/deflate) and no hashing (SHA/MD5) APIs. `cc.base64` exists but only on recent versions. Anything cryptographic or compression-related must be vendored pure Lua.
- Pure-Lua DEFLATE exists (LibDeflate CC fork in [MCJack123/CC-Archive](https://github.com/MCJack123/CC-Archive)) but is interpreter-slow: the LibDeflate maintainer measured order-of-10s for 100 KB on CC-era VMs and recommended capping CC usage around 200 KB, with mandatory periodic yields to dodge the "too long without yielding" abort. Viable as a fallback, bad as the primary path.
- Pure-Lua SHA-256 is proven and fast enough: [ccryptolib](https://github.com/migeyel/ccryptolib) (the modern CC standard, ~150 lines on `bit32`) and Anavrins' sha256 (~1,500 hashes/s community benchmark). **SHA-512 is feasible but pointless**: CC's VM has 32-bit `bit32` ops, so SHA-512 models 64-bit words as hi/lo pairs and runs strictly slower than SHA-256 for no security benefit at these threat levels.
- `package.path` is rebuilt per program by `cc.require`; a mutation in a startup file does not make libraries globally requireable for later programs. Default path patterns resolve relative to the running program's directory plus `/rom/modules/main`. ([require guide](https://tweaked.cc/guide/using_require.html))
- Startup: the computer runs `startup.lua` then every file in `/startup/` in order; the recommended installer pattern is a drop-in like `/startup/50_cpm.lua` rather than clobbering the user's `startup.lua`. `shell.setPath` called during startup persists for the shell session, which is how installed programs become invocable by name. ([startup guide](https://tweaked.cc/guide/startup.html))

### 1.4 Prior art

Every mainstream CC distribution tool (built-in `wget`/`pastebin`, SquidDev's artist installer, packman, Opus OS, gitget, ccpkg) uses **plain per-file HTTP GETs, no archives**; the modern ones parallelize (artist and Opus via `parallel.waitForAll`, gitget via `http.request` events), the older ones (packman) download sequentially. The one archive-based outlier (MCJack123's apt-lua, real `.deb` parsing in Lua) never became mainstream. The ecosystem converged on per-file for exactly the reason in 1.1: downloads are free, Lua CPU is not. Notably, none of the inspected installers verifies content hashes; integrity checking is something cpm adds over the prior art.

---

## 2. Package format: what the client downloads

### 2.1 Options considered

**A. Consume the existing `.tar.gz` tarball, gunzip + untar in Lua.**
Rejected. Pure-Lua inflate caps practical package size around 200 KB, costs seconds of VM time, and requires vendoring LibDeflate (~2,000 lines) plus a tar reader. It also burns the 1 MB disk twice (archive + extracted files) during install.

**B. Serve the tar with `Content-Encoding: gzip` on the wire, client extracts plain tar in Lua.**
Viable, and the runner-up. The stored `.tar.gz` bytes can even be served unchanged under that header, so Java decompresses and Lua receives plain tar: one request, no new stored artifact, and the registry change is only a header plus one new metadata field (sha256 of the inner tar, since the existing `shasum`/`integrity` cover the gzipped bytes the client never sees). Costs: a vendored ~150 line tar reader with its edge cases (ustar prefix, GNU long names, pax overrides) and yield discipline, maintained in Lua and redeployed fleet-wide on every bug; and the client parsing publisher-controlled bytes on-device (see 2.3). Choosing C over B is a trade of one-time registry work for the smallest possible fleet-side client.

**C. New endpoint serving a derived "bundle" artifact, gzip-compressed on the wire only. Chosen.**
The registry derives a bundle from the tarball once at publish time and stores it immutably alongside it. The chosen bundle form is a **manifest + blob container** (2.2): a small JSON manifest of paths, offsets, and lengths, followed by the raw concatenated file bytes. The client does one `http.get`, parses only the manifest with the built-in `textutils.unserialiseJSON`, and slices files out with `string.sub`: **zero vendored parser code**, no escaping or base64 of file contents, and the only JSON parsed is a few hundred bytes regardless of package size. A pure-JSON file map (contents embedded as JSON strings, binary via base64) was the earlier draft of this option and remains the fallback if the container's compression config (2.2) proves annoying, since `application/json` gets Cloudflare wire compression with zero configuration.

**D. Per-file GETs (the community norm, section 1.4).**
Rejected despite being the ecosystem default. One request per file multiplies Worker invocations and R2 Class B reads by the package's file count (R2 bills per operation: $0.36 per million reads, 10M/month free, so this is a tiebreaker at current scale rather than a real cost, but the multiplier is structural). More importantly it has no single hashable artifact, so per-file integrity metadata would be needed, and none of the surveyed per-file installers even attempts verification. The bundle keeps per-file's virtues (no Lua decompression, trivial parsing) in one request with one digest.

### 2.2 The bundle format

`GET /packages/{name}/{version}/dist/bundle` returns a length-prefixed manifest followed by raw file bytes:

```
<manifest byte length, ASCII decimal>\n
{"name":"example","version":"1.0.0","files":[
  {"path":"init.lua","offset":0,"length":1834},
  {"path":"bin/example.lua","offset":1834,"length":902},
  {"path":"assets/logo.nfp","offset":2736,"length":512}
]}
<concatenated raw file bytes>
```

The manifest is minified JSON (single line, no whitespace; the example above is formatted for readability only) and is emitted deterministically by the registry. Correctness never depends on its formatting: the length prefix delimits the manifest and the offsets locate the files, so minification is purely a size and determinism nicety.

Client-side consumption is a handful of lines: read the whole body in binary mode, hash it (section 3), read the first line as the manifest length, `unserialiseJSON` the manifest, then `string.sub` each file out by offset and length. File contents are never escaped, encoded, or parsed: text and binary files are byte-identical to their source, and JSON parsing touches only the manifest, so parse cost is independent of package size.

- Derived from the published tarball by the Worker at publish time (Workers have `DecompressionStream("gzip")` natively; tar parsing via a canonical JS package).
- Stored bytes are immutable and content-addressed like the tarball; the recorded digest is computed over exactly the stored bytes.
- File paths are validated at publish: relative, forward slashes, no `..`, no leading `/`; offsets and lengths are registry-computed, so the client never interprets an ambiguous archive format. The client still re-validates paths before writing (defense in depth against a compromised or misbehaving registry).
- **Wire compression must be arranged explicitly**: the container is `application/octet-stream`, which Cloudflare does not auto-compress (unlike `application/json`). Either a zone Compression Rule enabling gzip for the bundle content type, or storing the bundle pre-gzipped and serving it with an explicit `Content-Encoding: gzip`. The client sends `Accept-Encoding: gzip` (CC does not by default) and Netty decompresses at the Java layer. Only `gzip`/`deflate`, never `br`, since Netty's decompressor does not handle brotli.

The tarball endpoint stays as-is: it remains the publish format and the npm-compatible artifact for non-CC tooling.

### 2.3 Security considerations

- **Canonical-by-construction beats on-device parsing.** Under B the Lua extractor consumes publisher-controlled tar bytes, and tar's redundant path encodings are real traversal/smuggling surface (e.g. a pax path override writing `/startup.lua` for boot persistence). Validating at publish helps but introduces a parser differential: the TypeScript validator and the Lua extractor must agree about an ambiguous format. The container has exactly one interpretation, produced by the registry, with offsets and lengths it computed itself; the client never reasons about archive structure.
- **Decompression bombs at publish.** Both B and C gunzip uploads in the Worker; derivation must stream through `DecompressionStream` with a hard output cap and abort past it. On the client the blast radius is bounded regardless by `max_download` (16 MiB) and the 1 MB disk.
- **Digests prove delivery, not provenance.** Verification shows the client got the bytes the registry recorded; it says nothing about who published them, and installing a package is arbitrary code execution by design (programs land on the shell path). Publish is currently unauthenticated, which is acceptable for a private registry and the most important gap to close before third parties publish (section 11).
- **Fail closed.** Mangled transfer encoding or tampered storage produces a digest mismatch and the install aborts before any file is written; HTTPS covers the wire.

---

## 3. Integrity verification

- **Algorithm: SHA-256**, hex digest, computed over the raw bundle bytes as read from the response (post wire-decompression, i.e. the stored artifact bytes). SHA-512 is rejected per 1.3; SHA-1 (`shasum`) adds nothing.
- The registry computes and stores the bundle's sha256 at publish and serves it in version metadata (see 10). Hex rather than SRI base64 because hex comparison in Lua is trivial and avoids a base64 encoder dependency on older CC versions.
- Client implementation: vendor ccryptolib's `sha256` module (single file, `bit32` based), wrapped with a periodic yield (`os.queueEvent`/`os.pullEvent` every N blocks) so hashing a ~100 KB+ file cannot trip the ~7 s yield watchdog.
- Verification is **default on** and runs before any file is written: fetch bundle, hash bytes, compare to metadata digest, then parse and extract. Metadata arrives over HTTPS from the same origin, so this primarily protects against corruption, cache bugs, and storage tampering rather than MITM, which is the right threat model here and matches npm.
- Cost check: at roughly 1,500 hash-block-ops/s scale measured by the community, hashing tens of KB is well under a second; acceptable per install.

---

## 4. On-computer layout and `require` resolution

### 4.1 Layout

```
/cpm/
  packages/<name>/...    installed package trees, exactly one version per package
  bin/<program>.lua      generated shims for package programs
  state.json             install state (see section 5)
/startup/50_cpm.lua      startup drop-in: shell.setPath(shell.path() .. ":/cpm/bin")
/startup/60_cpm_<name>.lua  per-package startup hook, written for packages whose cpm.json declares `startup`
/cpm.lua                 the cpm CLI entry itself (a normal cpm-managed package program shim can replace this later)
```

Global installs only in v1. Rationale: the default drive is ~1 MB, so npm-style per-consumer duplication is unaffordable; a flat, single-version-per-package global store (LuaRocks/apt model) is the only layout that fits. Per-program isolated installs (a local `cpm_packages/` plus a `cc.require.make` wrapper environment) are a possible later feature, noted in open questions.

### 4.2 How `require` finds packages

The flat store composes cleanly with `cc.require` path patterns. With

```
package.path = "/cpm/packages/?.lua;/cpm/packages/?/init.lua;" .. package.path
```

resolution works as:

- `require("bar")` loads `/cpm/packages/bar/init.lua` (package entry point convention: `init.lua` at package root)
- `require("bar.util")` loads `/cpm/packages/bar/util.lua` (submodules)

Because `package.path` is per-program (1.3), that prepend line must run inside the consuming program. Three cases:

1. **Programs installed by cpm** (files under `bin/` in a package): cpm generates a shim in `/cpm/bin/<name>.lua` that prepends the path and then runs the real file, forwarding arguments:

   ```lua
   package.path = "/cpm/packages/?.lua;/cpm/packages/?/init.lua;" .. package.path
   local fn = assert(loadfile("/cpm/packages/example/bin/example.lua", nil, _ENV))
   return fn(...)
   ```

   `/cpm/bin` is on the shell path via the startup drop-in, so installed programs run by name.

2. **Packages requiring their dependencies**: they execute under a shim (or under another package that did), so the path is already set; plain `require("dep")` works.
3. **Ad-hoc user scripts** using cpm libraries: covered by the require hook (below), no boilerplate.

**The require hook** (added 2026-08-25, replacing an earlier `dofile("/cpm/boot.lua")` boilerplate design that was removed outright; it could not have worked anyway, since CC's `dofile` runs chunks against `_G`, where no `package` table exists to prepend to): every program environment in CC:Tweaked is created and passed through the global `load`, resolved at call time. Verified against the mc-1.20.x source: the shell's `executeProgram` calls `load(contents, "@/"..path, nil, env)` with the env from `createShellEnv` (which carries `package` from `cc.require.make`); bios `loadfile` calls the global `load`, so `os.run` flows through it too; the `lua` REPL evaluates input via `load(input, name, "t", tEnv)` with its own `cc.require` package; and none of them capture `load` as a local. The hook wraps `_G.load`: when a chunk is loaded with an env whose own `package.path` (via `rawget`, to skip inheritance through `__index = _G`) lacks the cpm prefix, the prefix is prepended. Result: `require("pkg")` works in any program, from any directory, and in the `lua` REPL. The hook has a single source, `hook.lua` inside the cpm package itself (`/cpm/packages/cpm/hook.lua`), run via `dofile` (against `_G`, all it touches) both by `/startup/50_cpm.lua` at boot and by the client after installs for the current session, so it updates with cpm like any other file. The shim prepend (case 1) is kept as belt and braces. Accepted risk: it is a monkey-patch of a core global; if a future CC version restructures its loaders the hook degrades to a no-op and the shims still cover installed programs.

### 4.3 Package content conventions

- `init.lua` at the package root: library entry point, returned table is the module.
- `bin/*.lua`: each file becomes an invocable program (shim per file, named by basename).
- Everything else: internal modules and assets, addressable as submodules or via `fs` relative to the package dir.
- `cpm.json` at the package root is the manifest and authoring-side source of truth: { name, version, author?, dependencies? }. It ships in the tarball (and so in the bundle, making installed packages self-describing); the registry parses it at publish; the former multipart `meta` field is gone, the tarball is the whole publish request. Future fields (description, bin aliases, entry overrides) have a natural home here.
- `startup` in `cpm.json` (optional): the path, relative to the package root, of a Lua file to run at computer startup. The registry rejects a publish whose declared startup file is not in the tarball. On install the client writes `/startup/60_cpm_<name>.lua`, which prepends the package path and runs the file; on remove (or when a new version drops the field) the hook is deleted. Hooks run after `50_cpm.lua`, so the shell path is already set. Startup files run sequentially, so a long-running daemon should put itself in the background (`multishell.launch` or `parallel` from its own code); cpm does not wrap it.
- Package names must not contain dots: `require` maps dots to directory separators, so a dotted name would install at a path `require` never searches. Dots are reserved until namespaced installs (dot-to-slash install paths) are designed deliberately.

---

## 5. Dependency resolution and install state

### 5.1 Resolver: server-side

The registry stores semver ranges per dependency, and correct npm-style range semantics (`^`, `~`, `||`, prerelease rules) are exactly the kind of domain where a hand-rolled Lua implementation would rot. There is no canonical npm-range-compatible Lua library, but the registry already depends on the canonical [`semver`](https://www.npmjs.com/package/semver) package. So: **resolution happens on the registry**, in a new endpoint:

```
POST /resolve
{ "dependencies": { "example": "^1.2.0", "other": "latest" } }
```

returning the fully pinned closure, JSend-wrapped, in install order:

```json
{
  "status": "success",
  "data": {
    "packages": [
      {
        "name": "dep",
        "version": "2.1.3",
        "dependencies": {},
        "dist": {
          "bundle": "/packages/dep/2.1.3/dist/bundle",
          "bundleSha256": "…",
          "bundleSize": 4096
        }
      },
      {
        "name": "example",
        "version": "1.4.0",
        "dependencies": { "dep": "^2.0.0" },
        "dist": { "…": "…" }
      }
    ]
  }
}
```

Resolution algorithm (server): breadth-first from the requested roots, collecting every range requested for each package name; pick the **highest version satisfying the intersection of all collected ranges** (flat store means one version per package, so ranges must be co-satisfiable); fail with a 400 JSend `fail` naming the conflicting package and ranges when they are not. Dist-tags (`latest`) are accepted wherever a range is.

The client consequently needs **no semver logic at all**: exact versions, tags, and ranges are all just strings passed to `/resolve`. This keeps the Lua client small and keeps version semantics in one place.

Trade-off accepted: resolution requires the registry to be reachable (it already must be, to download) and moves a little CPU to the Worker (negligible: the whole registry fits in one D1 read).

### 5.2 Install state, not a lockfile

`/cpm/state.json` (read/written with `textutils`):

```json
{
  "roots": { "example": "^1.2.0" },
  "installed": { "example": "1.4.0", "dep": "2.1.3" }
}
```

- `roots`: what the user explicitly asked for, with the requested spec (`cpm install example` records the resolved version as `^1.4.0`, npm-style; `cpm install example@1.2.3` records `1.2.3`).
- `installed`: the pinned result of the last resolve, i.e. this computer's lock.
- `cpm update` re-resolves `roots` and applies the diff; `cpm remove <name>` deletes the root and garbage-collects packages no longer reachable from remaining roots.

A separate committed lockfile in the npm sense is **not warranted for v1**: the consumer is a single computer, and `state.json` already pins it. Reproducible fleet provisioning (many turtles installing an identical set) can later reuse the same file verbatim (`cpm install --from state.json`), which is the lockfile use case without a new format.

### 5.3 Install flow

1. `POST /resolve` with roots (existing plus new).
2. Diff against `state.json`; compute download set.
3. Check `fs.getFreeSpace` against summed `dist.bundle.size`; abort early with a clear message if it does not fit.
4. Download bundles with `parallel.waitForAll`, capped at 4 concurrent (politeness; limit is 16), `Accept-Encoding: gzip`, `binary = true`, one retry on failure.
5. Per bundle: sha256-verify bytes (yielding), parse the manifest, validate paths, slice and write files to a staging dir `/cpm/.staging/<name>/`, then atomically-ish swap into `/cpm/packages/<name>/` (delete old, move new) so a failed install never leaves a half-written package as live.
6. Regenerate `/cpm/bin` shims and write `state.json` last.

---

## 6. Bootstrap

One-liner on a fresh computer, using the built-in `wget run`:

```
wget run https://registry.cpm.chungindustries.com/install
```

- New registry endpoint `GET /install` serves the installer as plain Lua (`Content-Type: text/plain`). No auth, aggressively cacheable with a short TTL (it changes on cpm releases).
- The installer is a small, dependency-free, single-file Lua script that: checks `http` is enabled, fetches the `cpm` package's own bundle via `/resolve` + `/packages/cpm/{v}/dist/bundle` (cpm is published as a normal package named `cpm`), verifies, installs it into the same `/cpm/` layout, then delegates the rest (shims, `/startup/50_cpm.lua`, shell path, require hook) to the freshly extracted package's own `store.lua` so `cpm` works immediately in the current session without reboot.
- Self-update is then just `cpm update cpm`: cpm is a package like any other, so the bootstrap path never needs to be special-cased again.
- The installer file itself is a build artifact of the client repo (section 7) embedded into or fetched by the Worker at deploy time.

---

## 7. Repo structure

NX project `apps/cpm-cli` (Lua, not TypeScript; it is still an NX project via its `package.json`, with targets wrapping Lua tooling). Note: a parked migration of the old ChungPackageManager already exists under exactly this path on the local snapshot branch `claude/stupefied-nightingale-2df752` (package.json with `lang:lua` tags, `.luacheckrc`, `stylua.toml`, and a 327-line WIP `cpm.lua` with known bugs). That snapshot is the scaffolding starting point; the WIP `cpm.lua` predates this design and should be treated as reference material, not a base to patch, since it was written against a different install model.

```
apps/cpm-cli/
  package.json           NX targets: lint, test, build, publish
  README.md
  src/
    cpm.lua              CLI entry (arg parsing, command dispatch)
    cpm/
      commands/          install.lua, remove.lua, update.lua, list.lua, ...
      registry.lua       HTTP client for the registry API (JSend unwrapping)
      bundle.lua         bundle fetch, verify, extract
      store.lua          /cpm layout, staging swap, shim + boot generation
      state.lua          state.json read/write, closure GC
  vendor/
    sha256.lua           ccryptolib sha256 (vendored, license header retained)
  installer/
    install.lua          bootstrap script source (kept dependency-free)
  tests/
```

- Domain-grouped like the rest of the monorepo (vertical slices per command/concern), matching the repo convention even though the language differs.
- **Lint/format**: the parked snapshot already configured luacheck + stylua; keep those unless there is a reason to switch (selene is the more modern linter with a CC:Tweaked std definition, but luacheck is already wired up). Open question below.
- **Test**: pure-logic modules (state diffing, path validation, resolver-response handling) run under plain Lua with stubbed CC globals; end-to-end install tests run headless in the [CraftOS-PC](https://www.craftos-pc.cc/) emulator in CI against a local registry (`wrangler dev` or the in-memory store).
- **Build**: a small Node script (this is still a pnpm monorepo, so Node is the natural glue) that assembles the publishable tarball from `src/` and produces the single-file `install.lua` artifact.
- **Publish**: CI target that POSTs the tarball to the registry; cpm-cli releases ride the existing `nx release` version-plan flow like every other project.

---

## 8. Client CLI surface (v1)

```
cpm install <name>[@<version|range|tag>] ...
cpm remove <name> ...
cpm update [<name> ...]
cpm list                     installed packages and versions
cpm search [<query>]         from GET /packages (client-side filter for now)
```

Kept deliberately npm-shaped. `publish` is intentionally absent from the in-game client: publishing happens from real machines (see open questions).

---

## 9. Decision summary

| Topic                 | Decision                                                                                                                                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Download format       | New derived "bundle" endpoint: length-prefixed JSON manifest + raw file blob; gzip on the wire only (`Accept-Encoding: gzip`); manifest parsed with built-in `textutils.unserialiseJSON`, files sliced by offset |
| Gzip in Lua           | Avoided entirely (Java-side wire decompression); LibDeflate not vendored                                                                                                                                         |
| Tar in Lua            | Avoided (bundle replaces it); tarball endpoint remains for publish/tooling                                                                                                                                       |
| Integrity             | SHA-256 hex over bundle bytes, vendored ccryptolib, yields while hashing, default on; SHA-512 rejected on 32-bit VM grounds                                                                                      |
| Install layout        | Global flat store `/cpm/packages/<name>/`, one version per package; shims in `/cpm/bin` + `/startup/50_cpm.lua`, which runs the require hook (`hook.lua` in the cpm package)                                   |
| Dependency resolution | Server-side `POST /resolve` using the canonical `semver` package; client has zero semver logic; highest-satisfying-intersection, hard fail on conflict                                                           |
| Lockfile              | No separate lockfile; `/cpm/state.json` records roots + pinned installed set                                                                                                                                     |
| Bootstrap             | `wget run https://registry.cpm.chungindustries.com/install`; cpm is itself a package named `cpm`; self-update via `cpm update cpm`                                                                               |
| Repo                  | `apps/cpm-cli` NX project (Lua), resurrecting the parked snapshot branch; luacheck + stylua, CraftOS-PC headless e2e, Node build glue; releases via version plans                                                |

## 10. Registry follow-up work items

Each of these is a registry change implied by this design, to be done as normal PRs with version plans:

1. **Bundle derivation and endpoint**: at publish, gunzip + untar the uploaded tarball (Workers `DecompressionStream` with a streamed output cap against decompression bombs; canonical JS tar package), validate entry paths (relative, no `..`, no absolute), build the manifest + blob container (2.2), store it in R2 content-addressed, record `dist.bundle.sha256` (hex) and `dist.bundle.size`. Serve `GET /packages/{name}/{version}/dist/bundle` with the same immutable edge-cache treatment as the tarball. Reject publishes whose tarball is not a valid gzipped tar or whose extracted size is unreasonable for CC disks (limit TBD, e.g. 512 KB extracted).
2. **Bundle wire compression**: `application/octet-stream` is not auto-compressed by Cloudflare, so add a zone Compression Rule for the bundle route (or store the bundle pre-gzipped and serve `Content-Encoding: gzip` explicitly). Verify end to end from CC that the client actually receives gzip transfer encoding (and no brotli negotiation surprises) once the client exists.
3. **Version metadata additions**: `dist` becomes one nested entry per artifact kind: `dist.tarball = { url, shasum, integrity }` and `dist.bundle = { url, sha256, size }`. Backfill or re-derive for any already-published versions.
4. **`POST /resolve`**: pinned-closure resolution as specified in 5.1, using the existing `semver` dependency; JSend `fail` with named conflicts on unsatisfiable input; accepts dist-tags anywhere a range is accepted.
5. **`GET /install`**: serve the built `install.lua` as `text/plain`. Mechanism for getting the artifact into the Worker (embedded at deploy vs fetched from R2) decided at implementation time.

## 11. Open questions

- **Extracted-size limit** for publishes (item 1): what cap fits CC's 1 MB default disk while leaving room for user data? Initial suggestion 512 KB, revisit with real packages.
- **Lint/test tooling**: keep the snapshot's luacheck + stylua, or switch to selene (better CC:Tweaked std support)? CraftOS-PC vs CCEmuX for e2e? The old blocker (no local Lua tooling to validate the CI lane) still needs a decision: install locally, or start the CI lane lenient. Decide when resurrecting `apps/cpm-cli`.
- **Publishing tooling for authors**: out of scope here; presumably a small TS CLI (or CI-only flow) on real machines. Where does it live, and when does the registry grow auth for publishes? (Publish is currently unauthenticated, which is fine for a private registry but worth revisiting before third parties publish.)
- **Ad-hoc script ergonomics**: resolved 2026-08-25 by the require hook in section 4.2 (wrapping the global `load`, single-sourced as `hook.lua` in the cpm package); the `boot.lua` boilerplate is gone. An upstream CC:Tweaked extra-path setting would still be the cleaner mechanism if one ever appears.
- **Per-folder installs**: considered and explicitly deferred (2026-08-24). The registry needs no changes (`POST /resolve` takes an arbitrary root map, so any folder can resolve independently); the client sketch is `cpm install --dir <folder>` writing a local `cpm_packages/` plus state file, with `package.path` checking local before global. Revisit only when two things on one computer actually need conflicting versions; the flat store errors loudly when that happens.
- **Fleet provisioning**: `cpm install --from state.json` (reusing a known-good state file) as a cheap lockfile-equivalent for provisioning many turtles; not in v1.

## 12. Sources

- CC:Tweaked `http` API: https://tweaked.cc/module/http.html
- `http.rules` and local IPs guide: https://tweaked.cc/guide/local_ips.html
- Default limits: [AddressRule.java](https://github.com/cc-tweaked/CC-Tweaked/blob/mc-1.20.x/projects/core/src/main/java/dan200/computercraft/core/apis/http/options/AddressRule.java), [AddressRuleConfig.java](https://github.com/cc-tweaked/CC-Tweaked/blob/mc-1.20.x/projects/common/src/main/java/dan200/computercraft/shared/config/AddressRuleConfig.java), [CoreConfig.java](https://github.com/cc-tweaked/CC-Tweaked/blob/mc-1.20.x/projects/core/src/main/java/dan200/computercraft/core/CoreConfig.java)
- Wire decompression: [HttpRequest.java](https://github.com/cc-tweaked/CC-Tweaked/blob/mc-1.20.x/projects/core/src/main/java/dan200/computercraft/core/apis/http/request/HttpRequest.java)
- `fs`, `settings`, `shell`, startup, `require`: https://tweaked.cc/module/fs.html, https://tweaked.cc/module/settings.html, https://tweaked.cc/module/shell.html, https://tweaked.cc/guide/startup.html, https://tweaked.cc/guide/using_require.html, https://tweaked.cc/library/cc.require.html
- Pure-Lua DEFLATE: [SafeteeWoW/LibDeflate](https://github.com/SafeteeWoW/LibDeflate), [gzip PR discussion with CC perf numbers](https://github.com/SafeteeWoW/LibDeflate/pull/2), [MCJack123/CC-Archive](https://github.com/MCJack123/CC-Archive) (gzip + tar for CC)
- Hashing: [migeyel/ccryptolib](https://github.com/migeyel/ccryptolib), [Anavrins sha256 forum thread with benchmarks](https://ccf.squiddev.cc/topic/8169-sha256-in-pure-lua.html), [Egor-Skriptunoff/pure_lua_SHA](https://github.com/Egor-Skriptunoff/pure_lua_SHA) (SHA-512 on bit32 feasibility)
- Prior art: [SquidDev-CC/artist installer](https://raw.githubusercontent.com/SquidDev-CC/artist/HEAD/installer.lua), [lyqyd/cc-packman](https://github.com/lyqyd/cc-packman), [kepler155c/opus-installer](https://github.com/kepler155c/opus-installer), [MCJack123/apt-lua](https://github.com/MCJack123/apt-lua)
