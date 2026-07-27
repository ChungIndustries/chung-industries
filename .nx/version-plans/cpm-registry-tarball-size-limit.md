---
cpm-registry: minor
---

Cap published tarballs at 5 MiB. Publishing a larger tarball now returns 413 and nothing is written to the index or the bucket, keeping the currently unauthenticated publish endpoint from being used to run up storage.
