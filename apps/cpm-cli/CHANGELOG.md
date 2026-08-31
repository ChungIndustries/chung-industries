## 0.0.2 (2026-08-31)

### 🚀 Features

- cpm's commands are now declared through the new `cli` package, its first registry dependency. The help text is generated from those declarations, and there is a new `cpm help [<command>]`. The bootstrap installer now installs cpm's full dependency closure instead of only the cpm package itself. ([#86](https://github.com/ChungIndustries/chung-industries/issues/86))

### 🧱 Updated Dependencies

- Updated cli to 0.0.1

### ❤️ Thank You

- Christian Mattsson
- Claude Fable 5

## 0.0.1 (2026-08-25)

### 🚀 Features

- Packages declaring a `startup` file in their `cpm.json` get a `/startup/60_cpm_<name>.lua` drop-in that runs it at boot; the hook is removed with the package. ([6506e9a](https://github.com/ChungIndustries/chung-industries/commit/6506e9a))
- Initial cpm client for CC:Tweaked: `install`, `remove`, `update`, `list`, and `search` against the registry, with server-side dependency resolution, sha256-verified bundle downloads, a flat `/cpm/packages` store with shell-path shims, and a self-contained bootstrap installer. ([21cb0d7](https://github.com/ChungIndustries/chung-industries/commit/21cb0d7))
- `require` finds installed packages from any program, directory, or the `lua` REPL with no boilerplate: the startup drop-in runs `hook.lua` from the cpm package, which wraps the global `load` and prepends the cpm store to each new program environment's `package.path`. cpm refreshes the startup drop-in on every sync so hook changes roll out with cpm updates. ([a416311](https://github.com/ChungIndustries/chung-industries/commit/a416311))

### ❤️ Thank You

- Christian Mattsson
- Claude Fable 5