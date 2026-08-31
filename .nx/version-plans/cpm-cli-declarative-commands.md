---
cpm-cli: minor
---

cpm's commands are now declared through the new `cli` package, its first registry dependency. The help text is generated from those declarations, and there is a new `cpm help [<command>]`. The bootstrap installer now installs cpm's full dependency closure instead of only the cpm package itself.
