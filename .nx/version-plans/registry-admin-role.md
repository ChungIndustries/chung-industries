---
cpm-registry: minor
---

Accounts can now be admins: `user.role` from Better Auth's admin plugin (`0010_admin.sql`) grants the `admin` scope to that person's website session, which is what publishing a reserved name checks and what upcoming registry-wide reads will require. Tokens never carry it. The first admin is set by hand in D1; further ones through `/auth/admin/set-role`.
