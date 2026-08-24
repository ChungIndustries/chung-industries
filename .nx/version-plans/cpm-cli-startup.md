---
cpm-cli: minor
---

Packages declaring a `startup` file in their `cpm.json` get a `/startup/60_cpm_<name>.lua` drop-in that runs it at boot; the hook is removed with the package.
