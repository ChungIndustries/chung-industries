---
cpm-cli: minor
---

`require` now finds installed packages from any program, directory, or the `lua` REPL with no boilerplate: the startup drop-in runs `hook.lua` from the cpm package, which wraps the global `load` and prepends the cpm store to each new program environment's `package.path`. The `/cpm/boot.lua` dofile boilerplate is gone, and cpm refreshes the startup drop-in on every sync.
