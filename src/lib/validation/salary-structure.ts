import { z } from "zod";
import { ACTIVE_STATUSES } from "@/lib/constants/school";
import { optionalNumber } from "@/lib/validation/shared";

const structureItemSchema = z.object({
  componentId: z.string().min(1),
  amount: optionalNumber(z.coerce.number().min(0)),
  percentage: optionalNumber(z.coerce.number().min(0).max(100)),
});

export const salaryStructureInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z.string().trim().max(500).optional(),
  status: z.enum(ACTIVE_STATUSES).default("active"),
  items: z.array(structureItemSchema).min(1, "Add at least one component"),
});

export type SalaryStructureInput = z.infer<typeof salaryStructureInputSchema>;

export const salaryStructureAssignmentInputSchema = z.object({
  structureId: z.string().min(1, "Structure is required"),
  effectiveFrom: z
    .string()
    .trim()
    .min(1, "Effective date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
});

export type SalaryStructureAssignmentInput = z.infer<typeof salaryStructureAssignmentInputSchema>;
