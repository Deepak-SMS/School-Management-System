import type { Role } from "@/types/user";

/** Human-readable labels for each role — shared by server (root layout) and client (user menu) code. */
export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  school_admin: "School Admin",
  principal: "Principal",
  teacher: "Teacher",
  accountant: "Accountant",
  hr: "HR Admin",
  hr_staff: "HR Staff",
  hod: "Head of Department",
  librarian: "Librarian",
  transport_manager: "Transport Manager",
  hostel_manager: "Hostel Manager",
  parent: "Parent",
  student: "Student",
};
