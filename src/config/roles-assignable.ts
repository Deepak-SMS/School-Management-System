import type { Role } from "@/types/user";

/**
 * Roles a school administrator may hand out from the organisation chart.
 *
 * `super_admin` is deliberately absent: it is platform-level access across every
 * tenant, so it can't be granted from inside one school. `parent` and `student`
 * are also absent — those accounts come from the admissions and portal flows,
 * not from the staff chart.
 */
export const ASSIGNABLE_ROLES = [
  "school_admin",
  "principal",
  "hr",
  "hr_staff",
  "hod",
  "accountant",
  "teacher",
  "librarian",
  "transport_manager",
  "hostel_manager",
] as const satisfies readonly Role[];

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const ASSIGNABLE_ROLE_LABELS: Record<AssignableRole, string> = {
  school_admin: "School Admin",
  principal: "Principal",
  hr: "HR Admin",
  hr_staff: "HR Staff",
  hod: "Head of Department",
  accountant: "Accountant",
  teacher: "Teacher",
  librarian: "Librarian",
  transport_manager: "Transport Manager",
  hostel_manager: "Hostel Manager",
};

/** One-line summary of what each role can reach, shown when granting access. */
export const ASSIGNABLE_ROLE_HINTS: Record<AssignableRole, string> = {
  school_admin: "Everything in this school, including pay data and role changes",
  principal: "Oversight of students, staff and hiring — no pay data",
  hr: "Full HR and recruitment, including pay data",
  hr_staff: "Day-to-day HR, without pay data or deletions",
  hod: "Their own department's staff and performance",
  accountant: "Pay data and payroll-facing employee details",
  teacher: "Their classes and the student roster, read-only",
  librarian: "Library records",
  transport_manager: "Transport records",
  hostel_manager: "Hostel records",
};
