---
cpm-registry: minor
---

The `cpm.json` manifest accepts an optional `startup` field: the path of a Lua file inside the package that the client runs at computer startup. A publish whose declared startup file is missing from the tarball is rejected.
