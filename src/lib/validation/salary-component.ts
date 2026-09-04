import { z } from "zod";
import { SALARY_COMPONENT_TYPES, CALCULATION_TYPES } from "@/lib/constants/payroll";
import { ACTIVE_STATUSES } from "@/lib/constants/school";
import { optionalNumber } from "@/lib/validation/shared";

export const salaryComponentInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  code: z.string().trim().min(1, "Code is required").max(30),
  componentType: z.enum(SALARY_COMPONENT_TYPES),
  calculationType: z.enum(CALCULATION_TYPES).default("fixed"),
  amount: optionalNumber(z.coerce.number().min(0)),
  percentage: optionalNumber(z.coerce.number().min(0).max(100)),
  formula: z.string().trim().max(255).optional(),
  isTaxable: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
  status: z.enum(ACTIVE_STATUSES).default("active"),
});

export type SalaryComponentInput = z.infer<typeof salaryComponentInputSchema>;
