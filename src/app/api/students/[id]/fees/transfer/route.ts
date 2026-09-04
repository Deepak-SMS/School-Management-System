import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { studentFeeTransferInputSchema } from "@/lib/validation/student-fee";
import { chargeAdjustedAmount } from "@/lib/student-fee-ledger";
import { studentFeeChargeInclude } from "@/lib/student-fee-response";

/**
 * Moves an outstanding amount off one charge onto another student's account —
 * e.g. billing a sibling's fee to the elder sibling's account. Implemented as
 * two ledger effects rather than a dedicated model: a `transfer_out`
 * adjustment reduces the source charge, and a new ad-hoc StudentFeeCharge is
 * created on the receiving student (see StudentFeeAdjustment in
 * schema.prisma) — each side of the transfer has exactly one row.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("studentFees", "transfer");
    const { schoolId } = user;
    const { id: studentId } = await params;
    const input = studentFeeTransferInputSchema.parse(await request.json());

    if (input.targetStudentId === studentId) {
      return NextResponse.json({ error: "Choose a different student to receive the transfer." }, { status: 422 });
    }

    const [charge, sourceStudent, targetStudent] = await Promise.all([
      prisma.studentFeeCharge.findFirst({
        where: { id: input.chargeId, studentId, schoolId },
        include: studentFeeChargeInclude,
      }),
      prisma.student.findFirst({ where: { id: studentId, schoolId }, select: { firstName: true, lastName: true } }),
      prisma.student.findFirst({ where: { id: input.targetStudentId, schoolId }, select: { id: true } }),
    ]);

    if (!charge) return NextResponse.json({ error: "Charge not found." }, { status: 404 });
    if (charge.status === "cancelled") {
      return NextResponse.json({ error: "This charge is cancelled and can't be transferred." }, { status: 409 });
    }
    if (!targetStudent) return NextResponse.json({ error: "Receiving student not found." }, { status: 404 });

    const currentlyOwed = chargeAdjustedAmount(charge);
    if (input.amount > currentlyOwed + 0.01) {
      return NextResponse.json(
        { error: `Amount exceeds the ₹${currentlyOwed.toLocaleString("en-IN")} still payable on this charge.` },
        { status: 422 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.studentFeeAdjustment.create({
        data: {
          schoolId,
          studentId,
          chargeId: charge.id,
          type: "transfer_out",
          amount: input.amount,
          reason: input.reason,
          relatedStudentId: input.targetStudentId,
          appliedById: user.id,
        },
      });

      const targetCharge = await tx.studentFeeCharge.create({
        data: {
          schoolId,
          studentId: input.targetStudentId,
          feeStructureId: charge.feeStructureId,
          feeCategoryId: charge.feeCategoryId,
          label: `Transferred from ${sourceStudent?.firstName ?? "another student"} ${sourceStudent?.lastName ?? ""} — ${charge.label}`.trim(),
          amount: input.amount,
          dueDate: charge.dueDate,
          isManual: true,
          note: input.reason,
          createdById: user.id,
        },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "studentFeeAdjustment.transfer_out",
        entityType: "StudentFeeCharge",
        entityId: charge.id,
        after: { amount: input.amount, targetStudentId: input.targetStudentId, targetChargeId: targetCharge.id },
      });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "studentFeeCharge.transferIn",
        entityType: "StudentFeeCharge",
        entityId: targetCharge.id,
        after: { amount: input.amount, sourceStudentId: studentId, sourceChargeId: charge.id },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
