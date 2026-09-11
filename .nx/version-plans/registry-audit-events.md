---
cpm-registry: minor
---

The audit log now records every change a package goes through, not only deprecations: each publish, the ownership claim a first publish makes, and every maintainer added or removed. Each entry is written together with the change itself, so a change that is rejected leaves no entry. Nothing reads the log yet.
