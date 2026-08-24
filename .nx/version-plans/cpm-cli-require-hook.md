---
cpm-cli: minor
---

`require` now finds installed packages from any program, directory, or the `lua` REPL with no boilerplate: the startup drop-in wraps the global `load` and prepends the cpm store to each new program environment's `package.path`. `dofile("/cpm/boot.lua")` remains as a manual fallback, and cpm refreshes the startup and boot helpers on every sync.
