import { z } from "zod";
import { PAYMENT_METHODS, METHODS_REQUIRING_REFERENCE, type PaymentMethod } from "@/lib/constants/payments";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const paymentAllocationSchema = z.object({
  chargeId: z.string().trim().min(1),
  amount: z.number().positive(),
});

export const paymentInputSchema = z
  .object({
    studentId: z.string().trim().min(1, "Choose a student"),
    paidOn: z
      .string()
      .trim()
      .regex(DATE_RE, "Use the date format YYYY-MM-DD")
      .refine((v) => !Number.isNaN(Date.parse(v)), "That isn't a real date"),
    amount: z.number({ message: "Enter the amount received" }).positive("Amount must be more than zero"),
    method: z.enum(PAYMENT_METHODS),
    referenceNo: z.string().trim().max(80).optional(),
    bankName: z.string().trim().max(120).optional(),
    invoiceRef: z.string().trim().max(80).optional(),
    note: z.string().trim().max(500).optional(),
    /** Omit to settle oldest-due-first; supply to split the payment by hand. */
    allocations: z.array(paymentAllocationSchema).optional(),
  })
  .refine((v) => !METHODS_REQUIRING_REFERENCE.includes(v.method as PaymentMethod) || Boolean(v.referenceNo), {
    // Without it there is nothing to reconcile a bank line against.
    message: "This payment method needs a reference number (cheque no., UPI ref, transaction id)",
    path: ["referenceNo"],
  })
  .refine((v) => Date.parse(v.paidOn) <= Date.now(), {
    message: "A payment can't be dated in the future",
    path: ["paidOn"],
  });

export type PaymentInput = z.infer<typeof paymentInputSchema>;

export const cancelPaymentSchema = z.object({
  reason: z.string().trim().min(5, "Say why this payment is being cancelled").max(300),
});
