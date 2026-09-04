import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/constants/payments";
import { EXPENSE_ATTACHMENT_KINDS } from "@/lib/constants/expenses";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const dateString = z
  .string()
  .trim()
  .regex(DATE_RE, "Use the date format YYYY-MM-DD")
  .refine((v) => !Number.isNaN(Date.parse(v)), "That isn't a real date");

export const expenseInputSchema = z
  .object({
    categoryId: z.string().trim().min(1, "Choose a category"),
    title: z.string().trim().min(2, "Give this expense a short title").max(150),
    description: z.string().trim().max(1000).optional(),
    amount: z.number({ message: "Enter the amount" }).positive("Amount must be more than zero"),
    taxAmount: z.number().min(0, "Tax can't be negative").optional(),
    expenseDate: dateString,

    payeeName: z.string().trim().min(2, "Who was paid?").max(150),
    payeeContact: z.string().trim().max(80).optional(),
    payeeGstin: z.string().trim().max(20).optional(),

    paymentMethod: z.enum(PAYMENT_METHODS).optional(),
    referenceNo: z.string().trim().max(80).optional(),
    bankName: z.string().trim().max(120).optional(),

    campusId: z.string().trim().optional(),
    departmentId: z.string().trim().optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((v) => (v.taxAmount ?? 0) <= v.amount, {
    // Amount is the total including tax, so tax can never exceed it.
    message: "Tax can't be more than the total amount",
    path: ["taxAmount"],
  })
  .refine((v) => Date.parse(v.expenseDate) <= Date.now(), {
    message: "An expense can't be dated in the future",
    path: ["expenseDate"],
  });

export type ExpenseInput = z.infer<typeof expenseInputSchema>;

/**
 * PATCH accepts any subset of the fields.
 *
 * Built from its own object rather than `expenseInputSchema.partial()`: the
 * input schema carries `.refine()`s, and partial() on that would drop them
 * silently. Every field here is optional and carries no default — a default
 * under partial() would quietly reset a field the caller never mentioned.
 */
export const expenseUpdateSchema = z.object({
  categoryId: z.string().trim().min(1).optional(),
  title: z.string().trim().min(2).max(150).optional(),
  description: z.string().trim().max(1000).optional(),
  amount: z.number().positive("Amount must be more than zero").optional(),
  taxAmount: z.number().min(0, "Tax cannot be negative").optional(),
  expenseDate: dateString.optional(),
  payeeName: z.string().trim().min(2).max(150).optional(),
  payeeContact: z.string().trim().max(80).optional(),
  payeeGstin: z.string().trim().max(20).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  referenceNo: z.string().trim().max(80).optional(),
  bankName: z.string().trim().max(120).optional(),
  campusId: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
  note: z.string().trim().max(500).optional(),
});

export const submitExpenseSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

export const approveExpenseSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

export const rejectExpenseSchema = z.object({
  reason: z.string().trim().min(5, "Say why this is being rejected — it goes back to whoever raised it").max(500),
});

export const payExpenseSchema = z.object({
  paidOn: dateString.optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  referenceNo: z.string().trim().max(80).optional(),
  bankName: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
});

export const cancelExpenseSchema = z.object({
  reason: z.string().trim().min(5, "Say why this expense is being cancelled").max(300),
});

export const expenseAttachmentSchema = z.object({
  uploadedFileId: z.string().trim().min(1, "A file is required"),
  kind: z.enum(EXPENSE_ATTACHMENT_KINDS).optional(),
  label: z.string().trim().max(150).optional(),
});

export const expenseCategoryInputSchema = z.object({
  name: z.string().trim().min(2, "Name the category").max(100),
  code: z
    .string()
    .trim()
    .min(2, "Give it a short code")
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, hyphen or underscore only"),
  description: z.string().trim().max(300).optional(),
  approvalThreshold: z.number().min(0).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type ExpenseCategoryInput = z.infer<typeof expenseCategoryInputSchema>;
