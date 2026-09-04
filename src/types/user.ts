/**
 * `hr` is the HR Admin (full HR management); `hr_staff` is the limited HR
 * operator and `hod` manages only their own department's staff — both added for
 * the HR Portal's RBAC (spec §30). Authorization is decided by the permission
 * matrix in src/config/permissions.ts, never by checking role names inline.
 */
export type Role =
  | "super_admin"
  | "school_admin"
  | "principal"
  | "teacher"
  | "accountant"
  | "hr"
  | "hr_staff"
  | "hod"
  | "librarian"
  | "transport_manager"
  | "hostel_manager"
  | "parent"
  | "student";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  avatarInitials: string;
  role: Role;
  roleLabel: string;
  schoolIds: string[];
}

/** `parent`/`student` land in the portal shell instead of the admin one — see src/app/(portal). */
export function isPortalRole(role: Role): boolean {
  return role === "parent" || role === "student";
}

/**
 * The 4 broad buckets the login screen's role selector offers. Every
 * `Role` except `super_admin` (which signs in through the separate
 * /super-admin/login, never this one) falls into exactly one bucket — every
 * administrative/office role (school_admin, principal, accountant, hr,
 * hr_staff, hod, librarian, transport_manager, hostel_manager) is grouped
 * under "admin" since they all use the same admin app shell, just scoped by
 * the permission matrix rather than by a separate login tile each.
 */
export type LoginRoleGroup = "admin" | "teacher" | "parent" | "student";

export const LOGIN_ROLE_GROUPS: Record<LoginRoleGroup, Role[]> = {
  admin: ["school_admin", "principal", "accountant", "hr", "hr_staff", "hod", "librarian", "transport_manager", "hostel_manager"],
  teacher: ["teacher"],
  parent: ["parent"],
  student: ["student"],
};

export const LOGIN_ROLE_GROUP_LABELS: Record<LoginRoleGroup, string> = {
  admin: "Admin",
  teacher: "Teacher",
  parent: "Parent",
  student: "Student",
};
