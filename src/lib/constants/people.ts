/**
 * Single source of truth for every "enum-like" string field on Student/Staff.
 * SQLite has no native enum type (see prisma/schema.prisma), so these arrays
 * back both the Zod validation schemas and the UI <Select> options — add a
 * value here once and it's available everywhere.
 */

export const GENDERS = ["male", "female", "other"] as const;

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export const STUDENT_STATUSES = ["active", "inactive", "graduated", "transferred", "suspended"] as const;

export const STAFF_CATEGORIES = [
  "teacher",
  "principal",
  "admin_staff",
  "accountant",
  "librarian",
  "driver",
  "security",
  "support_staff",
  "other",
] as const;

export const STAFF_CATEGORY_LABELS: Record<(typeof STAFF_CATEGORIES)[number], string> = {
  teacher: "Teacher",
  principal: "Principal",
  admin_staff: "Administrative Staff",
  accountant: "Accountant",
  librarian: "Librarian",
  driver: "Driver",
  security: "Security",
  support_staff: "Support Staff",
  other: "Other",
};

export const EMPLOYMENT_STATUSES = ["active", "inactive", "resigned", "terminated"] as const;

export const EMPLOYEE_TYPES = ["full_time", "part_time", "contract"] as const;
