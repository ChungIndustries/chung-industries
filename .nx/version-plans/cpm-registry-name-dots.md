---
cpm-registry: minor
---

Reject dots in package names: Lua's require maps dots to directory separators, so a dotted name would install where require never looks. Dots stay reserved until namespaced installs are designed deliberately.
