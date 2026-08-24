import type { Role } from "@/types/user";
import type { PermissionAction, PermissionModule } from "@/types/permissions";

const ALL_MODULES: PermissionModule[] = [
  "schoolProfile",
  "campuses",
  "academicYears",
  "classes",
  "sections",
  "subjects",
  "departments",
];

const FULL_ACCESS: PermissionAction[] = ["view", "create", "edit", "delete", "export", "activate", "deactivate"];
const VIEW_EXPORT_EDIT: PermissionAction[] = ["view", "create", "edit", "export", "activate", "deactivate"];
const VIEW_EXPORT: PermissionAction[] = ["view", "export"];
const VIEW_ONLY: PermissionAction[] = ["view"];

function grant(modules: PermissionModule[], actions: PermissionAction[]): Partial<Record<PermissionModule, PermissionAction[]>> {
  return Object.fromEntries(modules.map((m) => [m, actions]));
}

/**
 * Static permission matrix for the School Management modules. There is no auth/session yet
 * (see src/lib/tenant.ts), so this is not server-enforced — it drives client-side UI gating
 * (show/hide Add/Edit/Delete/Export buttons) via useCurrentUser()'s mock role today, and is
 * ready to back real route guards once a session exists.
 */
export const ROLE_PERMISSIONS: Record<Role, Partial<Record<PermissionModule, PermissionAction[]>>> = {
  super_admin: grant(ALL_MODULES, FULL_ACCESS),
  school_admin: grant(ALL_MODULES, FULL_ACCESS),
  principal: grant(ALL_MODULES, VIEW_EXPORT_EDIT),
  teacher: grant(["classes", "sections", "subjects", "departments"], VIEW_EXPORT),
  accountant: {},
  hr: grant(["departments"], VIEW_ONLY),
  librarian: grant(["departments"], VIEW_ONLY),
  transport_manager: grant(["departments"], VIEW_ONLY),
  hostel_manager: grant(["departments"], VIEW_ONLY),
  parent: {},
  student: {},
};

export function hasPermission(role: Role, module: PermissionModule, action: PermissionAction): boolean {
  return ROLE_PERMISSIONS[role]?.[module]?.includes(action) ?? false;
}
