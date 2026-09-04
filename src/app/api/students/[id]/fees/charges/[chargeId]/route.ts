import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

/**
 * Removes a charge that was added by mistake. A manual charge with no
 * adjustments or payments against it is deleted outright; anything else
 * (structure-generated, or already touched by a waiver/discount/correction/
 * payment) is cancelled instead, so the ledger it's already part of never
 * loses a row — mirrors the delete-or-deactivate pattern used across this
 * codebase (see e.g. /api/employee-types/[id]).
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; chargeId: string }> }) {
  try {
    const user = await requirePermission("studentFees", "delete");
    const { schoolId } = user;
    const { id: studentId, chargeId } = await params;

    const existing = await prisma.studentFeeCharge.findFirst({
      where: { id: chargeId, studentId, schoolId },
      include: { adjustments: { select: { id: true } }, allocations: { select: { id: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Charge not found." }, { status: 404 });

    const untouched = existing.isManual && existing.adjustments.length === 0 && existing.allocations.length === 0;

    const result = await prisma.$transaction(async (tx) => {
      if (untouched) {
        await tx.studentFeeCharge.delete({ where: { id: chargeId } });
        await recordAudit(tx, {
          schoolId,
          userId: user.id,
          action: "studentFeeCharge.delete",
          entityType: "StudentFeeCharge",
          entityId: chargeId,
          before: existing,
        });
        return { cancelled: false };
      }

      await tx.studentFeeCharge.update({ where: { id: chargeId }, data: { status: "cancelled" } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "studentFeeCharge.cancel",
        entityType: "StudentFeeCharge",
        entityId: chargeId,
        before: existing,
      });
      return { cancelled: true };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return apiError(error);
  }
}
