import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { cancelPaymentSchema } from "@/lib/validation/payment";
import { cancelPayment, PaymentError } from "@/lib/fees/record-payment";
import { apiError } from "@/lib/api-error";

/**
 * Cancels a payment and voids its receipt.
 *
 * This is the only route in the module that changes a receipt, and it needs
 * `payments:delete` — which the accountant who took the money does not hold.
 * Nothing is removed from the database; both rows stay, marked.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("payments", "delete");
    const { id } = await params;
    const { reason } = cancelPaymentSchema.parse(await request.json());

    const payment = await cancelPayment(user, id, reason);
    return NextResponse.json(payment);
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return apiError(error);
  }
}
