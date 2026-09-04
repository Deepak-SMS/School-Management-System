import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { salaryComponentInputSchema } from "@/lib/validation/salary-component";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    const { schoolId } = await requirePermission("payroll", "view");
    const rows = await prisma.salaryComponent.findMany({
      where: { schoolId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
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
    const input = cleanEmptyStrings(salaryComponentInputSchema.parse(await request.json()));

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.salaryComponent.create({ data: { schoolId, ...input } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "salaryComponent.create",
        entityType: "SalaryComponent",
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
