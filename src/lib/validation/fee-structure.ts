import { z } from "zod";
import { FEE_FREQUENCIES } from "@/lib/constants/fees";

const optionalString = z.string().trim().max(255).optional();

const feeInstallmentSchema = z.object({
  /** Present when editing a row that already exists; absent for a newly-added one. */
  id: z.string().optional(),
  label: z.string().trim().min(1, "Label is required").max(60),
  dueDate: z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid due date"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
});

const installmentsSumToItemAmount = (item: { amount: number; installments: { amount: number }[] }) =>
  item.installments.length === 0 ||
  Math.abs(item.installments.reduce((sum, i) => sum + i.amount, 0) - item.amount) < 0.01;

const feeStructureItemSchema = z
  .object({
    id: z.string().optional(),
    feeCategoryId: z.string().min(1, "Fee category is required"),
    amount: z.coerce.number().positive("Amount must be greater than 0"),
    frequency: z.enum(FEE_FREQUENCIES).default("one_time"),
    isOptional: z.boolean().default(false),
    lateFeeRuleId: optionalString,
    installments: z.array(feeInstallmentSchema).default([]),
  })
  .refine(installmentsSumToItemAmount, {
    message: "Installment amounts must add up to the item's total amount",
    path: ["installments"],
  });

/** Base object (no refinements) — `.partial()` cannot be applied to a refined (ZodEffects) schema, so PATCH routes build their schema from this instead of feeStructureInputSchema. */
export const feeStructureBaseSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150),
  description: z.string().trim().max(1000).optional(),
  academicYearId: z.string().min(1, "Academic year is required"),
  classId: optionalString,
  sectionId: optionalString,
  studentCategoryId: optionalString,
  items: z.array(feeStructureItemSchema).min(1, "Add at least one fee item"),
});

function sectionRequiresClass(data: { classId?: string; sectionId?: string }) {
  return !data.sectionId || Boolean(data.classId);
}

export const feeStructureInputSchema = feeStructureBaseSchema.refine(sectionRequiresClass, {
  message: "Select a class before choosing a section",
  path: ["sectionId"],
});

export const feeStructureUpdateSchema = feeStructureBaseSchema.partial().refine(sectionRequiresClass, {
  message: "Select a class before choosing a section",
  path: ["sectionId"],
});

export type FeeStructureInput = z.infer<typeof feeStructureInputSchema>;
export type FeeStructureItemInput = z.infer<typeof feeStructureItemSchema>;
