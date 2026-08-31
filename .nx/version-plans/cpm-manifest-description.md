---
cpm-registry: minor
cpm-web: minor
---

Packages can now declare an optional `description` in their `cpm.json` manifest, stating what the package does. The registry validates and stores it at publish and returns it in package responses, and the website shows it under the package name in search results and on package pages, with search matching against it.
