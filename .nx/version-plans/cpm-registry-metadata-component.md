---
cpm-registry: patch
---

The package manifest (`cpm.json`) is its own `PackageVersionMetadata` component in the OpenAPI spec, which `PackageVersion` now composes, so publishing tools can generate the manifest type from the spec.
