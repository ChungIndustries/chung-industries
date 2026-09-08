---
cpm-cli: minor
---

`cpm install` and `cpm update` now warn about deprecated versions. After resolving and before downloading anything, they print the deprecation message of every version that is about to be installed or is already installed. The install still goes ahead.
