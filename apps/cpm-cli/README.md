# cpm-cli

The Chung Package Manager client: a Lua program for CC:Tweaked computers that installs packages from the [cpm registry](../cpm-registry). Design notes live in [docs/cpm-client-design.md](../../docs/cpm-client-design.md).

`src/` is the root of the published `cpm` package, so the client is itself installed and updated like any other package.

## Bootstrap

On a fresh computer:

```
wget run https://registry.cpm.chungindustries.com/install
```

The registry can be pointed elsewhere with `set cpm.registry https://...`.

## Commands

```
cpm install <name>[@<version|range|tag>] ...
cpm remove <name> ...
cpm update [<name> ...]      no names updates every root
cpm list
cpm search [<query>]
```

Version resolution happens on the registry (`POST /resolve`), so ranges, exact versions, and dist-tags are all accepted wherever a spec is. A bare `cpm install foo` records `^<resolved version>` as the root spec. `cpm update` re-resolves all roots: the store holds one version per package, so partial updates are not meaningful.

## On-computer layout

```
/cpm/packages/<name>/      one installed version per package
/cpm/bin/<program>.lua     shim per file under a package's bin/ (on the shell path)
/cpm/state.json            roots (what you asked for) and installed (what is on disk)
/startup/50_cpm.lua        shell path for /cpm/bin, and runs the require hook
/startup/60_cpm_<name>.lua runs a package's declared startup file at boot
```

Packages expose a library via `init.lua` at their root (`require("foo")`) and submodules as files (`require("foo.bar")`). Every bundle is sha256-verified before anything is written, and packages are extracted to `/cpm/.staging/<name>/` and swapped into place only once complete.

`require` finds installed packages from anywhere: any program, any directory, and the `lua` REPL, with no boilerplate. CC:Tweaked builds a fresh `package.path` per program, but every program environment is created through the global `load`, so the require hook wraps it once per boot and prepends `/cpm/packages` to each new environment's search path. The hook has a single source, `hook.lua` inside the cpm package itself: the startup drop-in runs it at boot, and cpm runs it after installs so it works in the current session without a reboot.

A package that declares `"startup": "<file>"` in its `cpm.json` gets a `/startup/60_cpm_<name>.lua` drop-in on install that runs that file at boot (after `50_cpm.lua`, so the shell path and `require` path are ready). The hook is regenerated on every install and removed when the package (or the field) goes away. Startup files run sequentially, so a long-running daemon should background itself (for example via `multishell.launch`) instead of blocking the boot sequence.

## Source layout

```
src/
  bin/cpm.lua      CLI entry and dispatch
  commands/        one file per command
  sync.lua         resolve, diff, download, verify, swap, garbage-collect
  registry.lua     registry endpoints (base URL from settings) on top of net.lua
  net.lua          HTTP helpers: JSend unwrapping, JSON requests, binary downloads
  bundle.lua       bundle container parsing, path validation, extraction
  store.lua        /cpm layout, shims, staging swap, boot and startup files
  state.lua        state.json read/write
  sha256.lua       vendored SHA-256 (bit32, yields while hashing)
  hook.lua         the global require hook (run by the startup drop-in and after installs)
  install.lua      self-contained bootstrap installer served at GET /install
```

`src/` is packed verbatim into the published tarball, plus a `cpm.json` manifest ({ name, version, author }) generated at build time from the workspace version so it has one source of truth. The registry requires that manifest at the package root and treats it as the metadata source of truth at publish.

## Tooling

| Task                           | Command                                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Build `dist/cpm-<version>.tgz` | `nx build cpm-cli`                                                                                                |
| Publish to the registry        | `nx publish:registry cpm-cli` (`CPM_REGISTRY_URL` is the target and required)                                     |
| Lint                           | `nx lint:lua cpm-cli` (needs [luacheck](https://github.com/lunarmodules/luacheck))                                |
| Format                         | `nx format:lua cpm-cli` / `nx format:lua:check cpm-cli` (needs [StyLua](https://github.com/JohnnyMorganz/StyLua)) |

Luacheck and StyLua are not part of the Node toolchain, so they run in the dedicated Lua workflow (`.github/workflows/lua.yml`) rather than the monorepo-wide `nx affected -t lint` lane.
