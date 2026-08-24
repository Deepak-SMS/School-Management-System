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
