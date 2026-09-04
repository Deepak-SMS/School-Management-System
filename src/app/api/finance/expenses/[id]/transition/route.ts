import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/authorize";
import { EXPENSE_STATUSES, type ExpenseStatus } from "@/lib/constants/expenses";
import { PAYMENT_METHODS } from "@/lib/constants/payments";
import { transition, ExpenseError } from "@/lib/finance/expense-service";
import {
  ACTION_PERMISSION,
  InvalidExpenseTransitionError,
  SelfApprovalError,
} from "@/lib/finance/expense-workflow";
import { apiError } from "@/lib/api-error";

const bodySchema = z.object({
  to: z.enum(EXPENSE_STATUSES),
  /** The rejection or cancellation reason; optional otherwise. */
  note: z.string().trim().max(500).optional(),
  /** Payment details, accepted only when marking an expense paid. */
  paidOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date format YYYY-MM-DD")
    .optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  referenceNo: z.string().trim().max(80).optional(),
  bankName: z.string().trim().max(120).optional(),
});

/** Moves that must say why. A rejection without a reason is useless to the author. */
const REASON_REQUIRED: ExpenseStatus[] = ["rejected", "cancelled"];

/**
 * The one endpoint that moves an expense through the workflow.
 *
 * The permission required depends on where it is going — `expenses:approve` to
 * approve or reject, `expenses:create` to submit, `expenses:edit` to pay or
 * cancel. That mapping lives in the workflow module, not here, so the rule is
 * stated once. Whether the move itself is legal, and whether the approver is
 * the submitter, are both settled inside the transaction.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = bodySchema.parse(await request.json());
    const to = body.to as ExpenseStatus;

    // Permission is chosen by the destination, then checked before anything else.
    const user = await requirePermission("expenses", ACTION_PERMISSION[to]);

    if (REASON_REQUIRED.includes(to) && (body.note ?? "").trim().length < 5) {
      return NextResponse.json(
        {
          error: to === "rejected" ? "Say why this is being rejected." : "Say why this expense is being cancelled.",
          fieldErrors: { note: ["Give a reason of at least 5 characters"] },
        },
        { status: 422 },
      );
    }

    const expense = await transition(user, id, to, {
      note: body.note,
      data:
        to === "paid"
          ? {
              paidOn: body.paidOn ? new Date(body.paidOn) : undefined,
              paymentMethod: body.paymentMethod,
              referenceNo: body.referenceNo,
              bankName: body.bankName,
            }
          : undefined,
    });

    return NextResponse.json(expense);
  } catch (error) {
    if (error instanceof SelfApprovalError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof InvalidExpenseTransitionError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof ExpenseError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return apiError(error);
  }
}
