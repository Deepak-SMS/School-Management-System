import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("payroll", "approve");
    const { schoolId } = user;
    const { id } = await params;

    const period = await prisma.payrollPeriod.findFirst({ where: { id, schoolId } });
    if (!period) return NextResponse.json({ error: "Payroll period not found." }, { status: 404 });
    if (period.status !== "processed") {
      return NextResponse.json({ error: "Process the period before approving it." }, { status: 409 });
    }

    const entryCount = await prisma.payrollEntry.count({ where: { periodId: id } });
    if (entryCount === 0) {
      return NextResponse.json({ error: "This period has no calculated entries to approve." }, { status: 409 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.payrollPeriod.update({
        where: { id },
        data: { status: "approved", approvedById: user.id, approvedAt: new Date() },
      });
      await tx.payrollEntry.updateMany({ where: { periodId: id }, data: { status: "approved" } });
      await recordAudit(tx, { schoolId, userId: user.id, action: "payrollPeriod.approve", entityType: "PayrollPeriod", entityId: id, before: period, after: row });
      return row;
    });

    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}
