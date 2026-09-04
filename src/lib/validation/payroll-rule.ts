import { z } from "zod";
import { PAYROLL_RULE_TYPES, EMPLOYEE_GROUPS } from "@/lib/constants/payroll";
import { ACTIVE_STATUSES } from "@/lib/constants/school";
import { optionalNumber } from "@/lib/validation/shared";

export const payrollRuleInputSchema = z.object({
  ruleType: z.enum(PAYROLL_RULE_TYPES),
  effectiveDate: z
    .string()
    .trim()
    .min(1, "Effective date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  rate: optionalNumber(z.coerce.number().min(0)),
  thresholdAmount: optionalNumber(z.coerce.number().min(0)),
  employeeContributionPercent: optionalNumber(z.coerce.number().min(0).max(100)),
  employerContributionPercent: optionalNumber(z.coerce.number().min(0).max(100)),
  applicableEmployeeGroup: z.enum(EMPLOYEE_GROUPS).default("all"),
  status: z.enum(ACTIVE_STATUSES).default("active"),
});

export type PayrollRuleInput = z.infer<typeof payrollRuleInputSchema>;
