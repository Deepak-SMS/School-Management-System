import { z } from "zod";
import { LATE_FEE_CALCULATION_TYPES } from "@/lib/constants/fees";
import { optionalNumber } from "@/lib/validation/shared";

/** Base object (no refinements) — `.partial()` cannot be applied to a refined (ZodEffects) schema, so PATCH routes build their schema from this instead of lateFeeRuleInputSchema. */
export const lateFeeRuleBaseSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  calculationType: z.enum(LATE_FEE_CALCULATION_TYPES).default("fixed"),
  amount: optionalNumber(z.coerce.number().positive("Amount must be greater than 0")),
  percentage: optionalNumber(z.coerce.number().positive().max(100, "Percentage cannot exceed 100")),
  graceDays: z.coerce.number().int().min(0).max(365).default(0),
  maxAmount: optionalNumber(z.coerce.number().positive()),
  status: z.enum(["active", "inactive"]).optional(),
});

/** Percentage rules need a `percentage`; fixed rules (including per-day-fixed) need an `amount`. */
function hasMatchingValue(data: { calculationType: string; amount?: number; percentage?: number }) {
  return data.calculationType.endsWith("percentage") ? data.percentage !== undefined : data.amount !== undefined;
}

export const lateFeeRuleInputSchema = lateFeeRuleBaseSchema.refine(hasMatchingValue, {
  message: "Enter an amount or percentage matching the calculation type",
  path: ["amount"],
});

export const lateFeeRuleUpdateSchema = lateFeeRuleBaseSchema.partial().refine(
  (data) => data.calculationType === undefined || hasMatchingValue({ calculationType: data.calculationType, amount: data.amount, percentage: data.percentage }),
  { message: "Enter an amount or percentage matching the calculation type", path: ["amount"] },
);

export type LateFeeRuleInput = z.infer<typeof lateFeeRuleInputSchema>;
