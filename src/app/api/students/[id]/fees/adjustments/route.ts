import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { studentFeeAdjustmentInputSchema } from "@/lib/validation/student-fee";
import { chargeAdjustedAmount } from "@/lib/student-fee-ledger";
import { studentFeeChargeInclude, shapeStudentFeeCharge } from "@/lib/student-fee-response";

/** Waives, discounts, or corrects one charge on a student's account. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("studentFees", "edit");
    const { schoolId } = user;
    const { id: studentId } = await params;
    const input = studentFeeAdjustmentInputSchema.parse(await request.json());

    const charge = await prisma.studentFeeCharge.findFirst({
      where: { id: input.chargeId, studentId, schoolId },
      include: studentFeeChargeInclude,
    });
    if (!charge) return NextResponse.json({ error: "Charge not found." }, { status: 404 });
    if (charge.status === "cancelled") {
      return NextResponse.json({ error: "This charge is cancelled and can't be adjusted." }, { status: 409 });
    }

    if (input.type !== "correction") {
      const currentlyOwed = chargeAdjustedAmount(charge);
      if (input.amount > currentlyOwed + 0.01) {
        return NextResponse.json(
          { error: `Amount exceeds the ₹${currentlyOwed.toLocaleString("en-IN")} still payable on this charge.` },
          { status: 422 },
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.studentFeeAdjustment.create({
        data: {
          schoolId,
          studentId,
          chargeId: charge.id,
          type: input.type,
          amount: input.amount,
          reason: input.reason,
          appliedById: user.id,
        },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: `studentFeeAdjustment.${input.type}`,
        entityType: "StudentFeeCharge",
        entityId: charge.id,
        after: { type: input.type, amount: input.amount, reason: input.reason },
      });

      return tx.studentFeeCharge.findUniqueOrThrow({ where: { id: charge.id }, include: studentFeeChargeInclude });
    });

    return NextResponse.json(shapeStudentFeeCharge(updated), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
