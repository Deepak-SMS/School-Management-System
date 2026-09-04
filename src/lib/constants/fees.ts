/**
 * Enum-like string fields for the Fees & Finance → Fee Structure module.
 * SQLite has no native enum type (see prisma/schema.prisma), so these arrays
 * back both the Zod validation schemas and the UI <Select> options.
 */

export const FEE_FREQUENCIES = ["one_time", "monthly", "quarterly", "half_yearly", "annually"] as const;

export const FEE_FREQUENCY_LABELS: Record<(typeof FEE_FREQUENCIES)[number], string> = {
  one_time: "One-time",
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Half-yearly",
  annually: "Annually",
};

export const FEE_STRUCTURE_STATUSES = ["draft", "published", "archived"] as const;

export const FEE_STRUCTURE_STATUS_LABELS: Record<(typeof FEE_STRUCTURE_STATUSES)[number], string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export const LATE_FEE_CALCULATION_TYPES = ["fixed", "percentage", "per_day_fixed", "per_day_percentage"] as const;

export const LATE_FEE_CALCULATION_LABELS: Record<(typeof LATE_FEE_CALCULATION_TYPES)[number], string> = {
  fixed: "Fixed amount",
  percentage: "Percentage of due amount",
  per_day_fixed: "Fixed amount per day late",
  per_day_percentage: "Percentage per day late",
};
