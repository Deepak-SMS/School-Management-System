import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { payrollReopenSchema } from "@/lib/validation/payroll";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { apiError } from "@/lib/api-error";

/** Reopens a locked period back to "approved" so it can be reprocessed — a deliberate, recorded act, never a silent edit. Slips already generated are left as-is; regenerating them is a separate, explicit action. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("payroll", "approve");
    const { schoolId } = user;
    const { id } = await params;
    const input = cleanEmptyStrings(payrollReopenSchema.parse(await request.json()));

    const period = await prisma.payrollPeriod.findFirst({ where: { id, schoolId } });
    if (!period) return NextResponse.json({ error: "Payroll period not found." }, { status: 404 });
    if (period.status !== "locked") {
      return NextResponse.json({ error: "Only a locked period can be reopened." }, { status: 409 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.payrollPeriod.update({
        where: { id },
        data: { status: "approved", reopenedById: user.id, reopenedAt: new Date(), reopenReason: input.reason },
      });
      await tx.payrollEntry.updateMany({ where: { periodId: id }, data: { status: "approved" } });
      await recordAudit(tx, { schoolId, userId: user.id, action: "payrollPeriod.reopen", entityType: "PayrollPeriod", entityId: id, before: period, after: row });
      return row;
    });

    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}
