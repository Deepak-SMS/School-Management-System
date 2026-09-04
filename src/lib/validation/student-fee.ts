import { z } from "zod";

const optionalString = z.string().trim().max(255).optional();

/** Either opt a student into an existing fee structure item (usually an optional one), or record a fully ad-hoc charge with no backing item. */
export const studentFeeChargeInputSchema = z
  .object({
    feeStructureItemId: optionalString,
    feeCategoryId: optionalString,
    label: z.string().trim().max(150).optional(),
    amount: z.coerce.number().positive("Amount must be greater than 0").optional(),
    dueDate: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid due date"),
    note: z.string().trim().max(500).optional(),
  })
  .refine((v) => Boolean(v.feeStructureItemId) || Boolean(v.feeCategoryId && v.label && v.amount !== undefined), {
    message: "Pick a fee item, or enter a fee category, label and amount for a custom charge",
    path: ["feeCategoryId"],
  });

export type StudentFeeChargeInput = z.infer<typeof studentFeeChargeInputSchema>;

/** `correction` may be signed (increase or decrease); waiver/discount are always a positive amount removed from the charge. */
export const studentFeeAdjustmentInputSchema = z
  .object({
    chargeId: z.string().min(1, "Select a charge"),
    type: z.enum(["waiver", "discount", "correction"]),
    amount: z.coerce.number().refine((v) => v !== 0, "Amount can't be zero"),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.type === "correction" || v.amount > 0, {
    message: "Amount must be greater than 0",
    path: ["amount"],
  });

export type StudentFeeAdjustmentInput = z.infer<typeof studentFeeAdjustmentInputSchema>;

export const studentFeeTransferInputSchema = z.object({
  chargeId: z.string().min(1, "Select the charge to transfer"),
  targetStudentId: z.string().min(1, "Select the receiving student"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  reason: z.string().trim().max(500).optional(),
});

export type StudentFeeTransferInput = z.infer<typeof studentFeeTransferInputSchema>;
