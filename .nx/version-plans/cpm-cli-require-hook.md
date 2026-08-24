---
cpm-cli: minor
---

`require` finds installed packages from any program, directory, or the `lua` REPL with no boilerplate: the startup drop-in runs `hook.lua` from the cpm package, which wraps the global `load` and prepends the cpm store to each new program environment's `package.path`. cpm refreshes the startup drop-in on every sync so hook changes roll out with cpm updates.
