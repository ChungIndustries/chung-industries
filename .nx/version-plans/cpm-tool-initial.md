---
cpm-tool: minor
---

New: the `cpm` command line tool for real computers. `cpm login`, `logout`, and `whoami` manage a publish token per registry; `cpm pack` builds a reproducible package tarball from a committed `cpm.json`; `cpm publish` packs and uploads it, treating an already-published version as success. Replaces the per-project build and publish scripts.
