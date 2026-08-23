---
cpm-registry: minor
---

Add `POST /resolve`, which pins one version per package for a set of root dependencies (semver ranges, exact versions, or dist-tags) and returns them dependencies-first. Resolution runs on the registry with the canonical `semver` package so the cpm client needs no semver logic.
