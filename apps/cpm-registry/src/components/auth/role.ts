/**
 * Admin as Better Auth's admin plugin models it: a `user.role` column holding
 * one or more comma-separated role names (docs/cpm-registry-auth-design.md,
 * section 12, decision 10). Nothing in the registry grants a role; the first
 * admin is set by hand in D1 and later ones through the plugin's
 * `/auth/admin/set-role`, by an existing admin.
 *
 * Kept free of any Better Auth import, like handle.ts, so the runtime
 * instance and the tests share the one rule.
 */

/** The role names that carry the `admin` scope; passed to the plugin as `adminRoles`. */
export const ADMIN_ROLES = ["admin"] as const;

/** Whether a `user.role` value (possibly `"user,admin"`) holds an admin role. */
export function isAdminRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return role.split(",").some((name) => (ADMIN_ROLES as readonly string[]).includes(name.trim()));
}
