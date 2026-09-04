import { z } from "zod";

export const payrollPeriodCreateSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export type PayrollPeriodCreateInput = z.infer<typeof payrollPeriodCreateSchema>;

/** Omitting `staffIds` processes every active staff member with a current salary structure assignment. */
export const payrollProcessSchema = z.object({
  staffIds: z.array(z.string()).optional(),
});

export type PayrollProcessInput = z.infer<typeof payrollProcessSchema>;

export const payrollReopenSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required to reopen a locked payroll period.").max(500),
});

export type PayrollReopenInput = z.infer<typeof payrollReopenSchema>;
