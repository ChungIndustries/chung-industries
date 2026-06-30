---
cpm-registry: minor
---

Make published versions immutable: re-publishing a version that already exists now returns 409 and never overwrites the stored tarball.
