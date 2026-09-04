import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { feeStructureInclude, shapeFeeStructure } from "@/lib/fee-structure-response";

/** Retires a fee structure without deleting it — its items, installments and assignment history stay intact for reporting. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("feeStructures", "deactivate");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.feeStructure.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Fee structure not found." }, { status: 404 });

    if (existing.status !== "archived") {
      await prisma.$transaction(async (tx) => {
        await tx.feeStructure.update({ where: { id }, data: { status: "archived" } });
        await recordAudit(tx, {
          schoolId,
          userId: user.id,
          action: "feeStructure.archive",
          entityType: "FeeStructure",
          entityId: id,
          before: existing,
        });
      });
    }

    const updated = await prisma.feeStructure.findUniqueOrThrow({ where: { id }, include: feeStructureInclude });
    return NextResponse.json(await shapeFeeStructure(updated));
  } catch (error) {
    return apiError(error);
  }
}
