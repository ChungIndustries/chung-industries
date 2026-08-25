## 0.0.1 (2026-08-25)

### 🚀 Features

- Packages declaring a `startup` file in their `cpm.json` get a `/startup/60_cpm_<name>.lua` drop-in that runs it at boot; the hook is removed with the package. ([6506e9a](https://github.com/ChungIndustries/chung-industries/commit/6506e9a))
- Initial cpm client for CC:Tweaked: `install`, `remove`, `update`, `list`, and `search` against the registry, with server-side dependency resolution, sha256-verified bundle downloads, a flat `/cpm/packages` store with shell-path shims, and a self-contained bootstrap installer. ([21cb0d7](https://github.com/ChungIndustries/chung-industries/commit/21cb0d7))
- `require` finds installed packages from any program, directory, or the `lua` REPL with no boilerplate: the startup drop-in runs `hook.lua` from the cpm package, which wraps the global `load` and prepends the cpm store to each new program environment's `package.path`. cpm refreshes the startup drop-in on every sync so hook changes roll out with cpm updates. ([a416311](https://github.com/ChungIndustries/chung-industries/commit/a416311))

### ❤️ Thank You

- Christian Mattsson
- Claude Fable 5