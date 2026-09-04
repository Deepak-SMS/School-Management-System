import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/db";
import { paymentInputSchema } from "@/lib/validation/payment";
import { recordPayment, PaymentError } from "@/lib/fees/record-payment";
import { apiError } from "@/lib/api-error";

/** Payment history, newest first. */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("payments", "view");
    const params = request.nextUrl.searchParams;

    const studentId = params.get("studentId") ?? undefined;
    const status = params.get("status") ?? undefined;
    const page = Math.max(1, Number(params.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 25)));

    const where = { schoolId, ...(studentId && { studentId }), ...(status && { status }) };

    const [data, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
          receipt: { select: { id: true, receiptNumber: true, status: true } },
          allocations: { select: { id: true } },
        },
        orderBy: { paidOn: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.payment.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    return apiError(error);
  }
}

/**
 * Records a payment and issues its receipt in one transaction — see
 * src/lib/fees/record-payment.ts for why those are inseparable.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("payments", "create");
    const input = paymentInputSchema.parse(await request.json());

    const { payment, receipt, unallocated, balanceAfter } = await recordPayment(user, input);

    return NextResponse.json(
      {
        payment,
        receipt,
        unallocated,
        balanceAfter: balanceAfter.totalOutstanding,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ error: error.message, fieldErrors: error.fieldErrors }, { status: error.status });
    }
    return apiError(error);
  }
}
