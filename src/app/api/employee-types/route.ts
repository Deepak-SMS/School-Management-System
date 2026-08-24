import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { employeeTypeInputSchema, EMPLOYEE_TYPE_DEFAULTS } from "@/lib/validation/employeeType";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("employeeTypes", "view");
    const params = request.nextUrl.searchParams;
    const q = params.get("q")?.trim();
    const status = params.get("status") ?? undefined;

    const where: Prisma.EmployeeTypeWhereInput = {
      schoolId,
      ...(status && { status }),
      ...(q && { OR: [{ name: { contains: q } }, { code: { contains: q } }] }),
    };

    const rows = await prisma.employeeType.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    // Headcount per type, so the settings screen shows what is actually in use
    // and an admin can see before deactivating one.
    const data = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        counts: { employees: await prisma.staff.count({ where: { schoolId, employeeTypeId: row.id } }) },
      })),
    );

    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("employeeTypes", "create");
    const { schoolId } = user;
    const input = cleanEmptyStrings(employeeTypeInputSchema.parse(await request.json()));

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.employeeType.create({ data: { schoolId, ...EMPLOYEE_TYPE_DEFAULTS, ...input } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "employeeType.create",
        entityType: "EmployeeType",
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
