/**
 * Enum-like string fields for the Student Fees module. SQLite has no native
 * enum type (see prisma/schema.prisma), so these arrays back both the Zod
 * validation schemas and the UI <Select> options.
 */

export const STUDENT_FEE_ADJUSTMENT_TYPES = ["waiver", "discount", "correction", "transfer_out"] as const;

export const STUDENT_FEE_ADJUSTMENT_LABELS: Record<(typeof STUDENT_FEE_ADJUSTMENT_TYPES)[number], string> = {
  waiver: "Waiver",
  discount: "Discount",
  correction: "Amount adjustment",
  transfer_out: "Transferred to another student",
};

export const STUDENT_FEE_CHARGE_STATUSES = ["active", "cancelled"] as const;
