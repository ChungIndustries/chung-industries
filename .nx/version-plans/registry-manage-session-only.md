---
cpm-registry: minor
---

Publish tokens now only publish. Adding or removing maintainers (and, when they ship, transfers and unpublish) needs the website sign-in; a token sent to those endpoints gets a 403 saying so. Tokens could never actually be minted with wider scopes, so no existing token changes behaviour.
