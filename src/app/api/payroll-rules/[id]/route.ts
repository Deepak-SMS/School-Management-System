import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { payrollRuleInputSchema } from "@/lib/validation/payroll-rule";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { apiError } from "@/lib/api-error";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("payroll", "edit");
    const { schoolId } = user;
    const { id } = await params;
    const input = cleanEmptyStrings(payrollRuleInputSchema.partial().parse(await request.json()));

    const existing = await prisma.payrollRule.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Payroll rule not found." }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.payrollRule.update({
        where: { id },
        data: { ...input, effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : undefined },
      });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "payrollRule.update",
        entityType: "PayrollRule",
        entityId: id,
        before: existing,
        after: row,
      });
      return row;
    });

    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("payroll", "delete");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.payrollRule.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Payroll rule not found." }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.payrollRule.delete({ where: { id } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "payrollRule.delete",
        entityType: "PayrollRule",
        entityId: id,
        before: existing,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
