export type Role =
  | "super_admin"
  | "school_admin"
  | "principal"
  | "teacher"
  | "accountant"
  | "hr"
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
