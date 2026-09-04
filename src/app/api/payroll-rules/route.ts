import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { payrollRuleInputSchema } from "@/lib/validation/payroll-rule";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    const { schoolId } = await requirePermission("payroll", "view");
    const rows = await prisma.payrollRule.findMany({
      where: { schoolId },
      orderBy: [{ ruleType: "asc" }, { effectiveDate: "desc" }],
    });
    return NextResponse.json({ data: rows, total: rows.length });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("payroll", "create");
    const { schoolId } = user;
    const input = cleanEmptyStrings(payrollRuleInputSchema.parse(await request.json()));

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.payrollRule.create({
        data: { schoolId, ...input, effectiveDate: new Date(input.effectiveDate) },
      });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "payrollRule.create",
        entityType: "PayrollRule",
        entityId: row.id,
        after: row,
      });
      return row;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
