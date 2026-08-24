---
cpm-registry: minor
---

Adopt `cpm.json` as the package manifest: every published tarball must carry one at its root ({ name, version, author?, dependencies? }), it is the metadata source of truth and replaces the multipart `meta` field, so a publish is just the tarball upload.
