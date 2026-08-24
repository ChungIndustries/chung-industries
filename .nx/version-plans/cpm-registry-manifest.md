---
cpm-registry: minor
---

Adopt `cpm.json` as the package manifest: every published tarball must carry one at its root ({ name, version, author?, dependencies? }) and it is the metadata source of truth; the multipart `meta` field is now an optional cross-check that must match it. Package names may no longer contain dots: Lua's require maps dots to directory separators, so dotted names are reserved until namespaced installs exist.
