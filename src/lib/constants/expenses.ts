/**
 * Enum-like string fields for the Expenses module. SQLite has no native enum
 * type (see prisma/schema.prisma), so these arrays back both the Zod schemas
 * and the UI <Select> options.
 */

export const EXPENSE_STATUSES = ["draft", "submitted", "approved", "rejected", "paid", "cancelled"] as const;

export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  draft: "Draft",
  submitted: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
  cancelled: "Cancelled",
};

/** Badge tone per status. A text label always accompanies the colour. */
export const EXPENSE_STATUS_TONES: Record<ExpenseStatus, "neutral" | "success" | "warning" | "danger"> = {
  draft: "neutral",
  submitted: "warning",
  approved: "success",
  rejected: "danger",
  paid: "success",
  cancelled: "neutral",
};

/** Statuses that still count against a budget — a rejected or cancelled expense doesn't. */
export const LIVE_EXPENSE_STATUSES: ExpenseStatus[] = ["draft", "submitted", "approved", "paid"];

/** Only these are actual money out of the door. */
export const SETTLED_EXPENSE_STATUSES: ExpenseStatus[] = ["paid"];

export const EXPENSE_ATTACHMENT_KINDS = ["bill", "invoice", "quotation", "receipt", "contract", "other"] as const;

export const EXPENSE_ATTACHMENT_KIND_LABELS: Record<(typeof EXPENSE_ATTACHMENT_KINDS)[number], string> = {
  bill: "Bill",
  invoice: "Invoice",
  quotation: "Quotation",
  receipt: "Payment receipt",
  contract: "Contract",
  other: "Other",
};

/**
 * The heads of expenditure the spec names. Seeded for a new school so the
 * module is usable immediately; a school edits the list or adds its own.
 */
export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: "Staff Salaries", code: "SAL", description: "Salaries, wages and statutory contributions" },
  { name: "Electricity", code: "ELEC", description: "Power bills across campuses" },
  { name: "Rent", code: "RENT", description: "Premises and equipment rent" },
  { name: "Maintenance", code: "MAINT", description: "Building and grounds upkeep" },
  { name: "Transportation", code: "TRANS", description: "Bus fuel, servicing and driver costs" },
  { name: "Stationery", code: "STAT", description: "Office and classroom stationery" },
  { name: "Software Subscriptions", code: "SOFT", description: "Licences and recurring software" },
  { name: "Laboratory Equipment", code: "LAB", description: "Science and computer lab equipment" },
  { name: "Events", code: "EVENT", description: "Functions, sports days and celebrations" },
  { name: "Repairs", code: "REPAIR", description: "Ad-hoc repairs to equipment and fittings" },
  { name: "Purchases", code: "PURCH", description: "Furniture, fittings and other capital purchases" },
  { name: "Other", code: "OTHER", description: "Operational costs that fit nowhere else" },
] as const;

export const EXPENSE_SERIES = "EXP";
