---
cpm-cli: minor
---

cpm's commands are now declared through the new `cli` package, its first registry dependency: `cpm help [<command>]` and all usage text are generated from the declarations, and the bootstrap installer installs cpm's full resolved dependency closure instead of only the cpm package itself.
