---
cpm-registry: minor
---

New `GET /search?q=` endpoint matching package names, authors, and descriptions, returning one summary per package (name, author, description, latest version, version count, publish time) instead of the full package document. Results rank name matches first and page with `limit` and `offset`; an empty query serves as the paginated index.
