import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { payrollPeriodCreateSchema } from "@/lib/validation/payroll";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

const periodInclude = {
  _count: { select: { entries: true } },
} satisfies Prisma.PayrollPeriodInclude;

function serialize<T extends { _count: { entries: number } }>({ _count, ...rest }: T) {
  return { ...rest, entryCount: _count.entries };
}

export async function GET() {
  try {
    const { schoolId } = await requirePermission("payroll", "view");
    const rows = await prisma.payrollPeriod.findMany({
      where: { schoolId },
      include: periodInclude,
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });
    return NextResponse.json({ data: rows.map(serialize), total: rows.length });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("payroll", "create");
    const { schoolId } = user;
    const input = payrollPeriodCreateSchema.parse(await request.json());

    const existing = await prisma.payrollPeriod.findUnique({
      where: { schoolId_year_month: { schoolId, year: input.year, month: input.month } },
    });
    if (existing) {
      return NextResponse.json({ error: "A payroll period for this month already exists." }, { status: 409 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.payrollPeriod.create({ data: { schoolId, year: input.year, month: input.month } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "payrollPeriod.create",
        entityType: "PayrollPeriod",
        entityId: row.id,
        after: row,
      });
      return row;
    });

    return NextResponse.json({ ...created, entryCount: 0 }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
