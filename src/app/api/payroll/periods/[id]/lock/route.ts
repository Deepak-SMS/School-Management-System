import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

/** Freezes an approved period — same AttendancePeriodLock discipline: no further edits until an authorized, recorded reopen. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("payroll", "approve");
    const { schoolId } = user;
    const { id } = await params;

    const period = await prisma.payrollPeriod.findFirst({ where: { id, schoolId } });
    if (!period) return NextResponse.json({ error: "Payroll period not found." }, { status: 404 });
    if (period.status !== "approved") {
      return NextResponse.json({ error: "Approve the period before locking it." }, { status: 409 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.payrollPeriod.update({
        where: { id },
        data: { status: "locked", lockedById: user.id, lockedAt: new Date() },
      });
      await tx.payrollEntry.updateMany({ where: { periodId: id }, data: { status: "locked" } });
      await recordAudit(tx, { schoolId, userId: user.id, action: "payrollPeriod.lock", entityType: "PayrollPeriod", entityId: id, before: period, after: row });
      return row;
    });

    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}
