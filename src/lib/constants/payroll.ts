/** Single source of truth for Payroll's "enum-like" string fields — see prisma/schema.prisma. */

export const SALARY_COMPONENT_TYPES = ["earning", "deduction"] as const;

export const SALARY_COMPONENT_TYPE_LABELS: Record<(typeof SALARY_COMPONENT_TYPES)[number], string> = {
  earning: "Earning",
  deduction: "Deduction",
};

export const CALCULATION_TYPES = ["fixed", "percentage_of_basic", "formula"] as const;

export const CALCULATION_TYPE_LABELS: Record<(typeof CALCULATION_TYPES)[number], string> = {
  fixed: "Fixed amount",
  percentage_of_basic: "Percentage of Basic",
  formula: "Formula (coming soon)",
};

export const PAYROLL_RULE_TYPES = ["pf", "esi", "professional_tax", "tds"] as const;

export const PAYROLL_RULE_TYPE_LABELS: Record<(typeof PAYROLL_RULE_TYPES)[number], string> = {
  pf: "Provident Fund (PF)",
  esi: "ESI",
  professional_tax: "Professional Tax",
  tds: "TDS",
};

export const EMPLOYEE_GROUPS = ["all", "teaching", "non_teaching"] as const;

export const EMPLOYEE_GROUP_LABELS: Record<(typeof EMPLOYEE_GROUPS)[number], string> = {
  all: "All employees",
  teaching: "Teaching staff",
  non_teaching: "Non-teaching staff",
};

export const PAYROLL_PERIOD_STATUSES = ["draft", "processing", "processed", "approved", "locked"] as const;

export const PAYROLL_PERIOD_STATUS_LABELS: Record<(typeof PAYROLL_PERIOD_STATUSES)[number], string> = {
  draft: "Draft",
  processing: "Processing",
  processed: "Processed",
  approved: "Approved",
  locked: "Locked",
};

export const PAYROLL_ENTRY_STATUSES = ["draft", "calculated", "approved", "locked"] as const;

export const PAYROLL_ENTRY_STATUS_LABELS: Record<(typeof PAYROLL_ENTRY_STATUSES)[number], string> = {
  draft: "Draft",
  calculated: "Calculated",
  approved: "Approved",
  locked: "Locked",
};

/** The SalaryComponent.code every `percentage_of_basic` component in the same structure resolves against. */
export const BASIC_COMPONENT_CODE = "BASIC";
