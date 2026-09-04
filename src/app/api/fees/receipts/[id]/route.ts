import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/db";
import { parseComponents } from "@/lib/fees/record-payment";
import { apiError } from "@/lib/api-error";

/**
 * One receipt.
 *
 * GET only. There is deliberately no PATCH and no DELETE on this route: a
 * receipt is an official document the family already holds a copy of, and the
 * only change it accepts is being voided, which happens through cancelling its
 * payment.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("receipts", "view");
    const { id } = await params;

    const receipt = await prisma.receipt.findFirst({
      where: { id, schoolId },
      include: {
        payment: {
          select: {
            id: true,
            paymentNumber: true,
            method: true,
            bankName: true,
            note: true,
            status: true,
            cancelReason: true,
            cancelledAt: true,
          },
        },
      },
    });
    if (!receipt) return NextResponse.json({ error: "Receipt not found." }, { status: 404 });

    return NextResponse.json({ ...receipt, components: parseComponents(receipt.componentsJson) });
  } catch (error) {
    return apiError(error);
  }
}
