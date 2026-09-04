import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { salaryStructureInputSchema } from "@/lib/validation/salary-structure";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

const structureInclude = {
  items: { include: { component: true }, orderBy: { sortOrder: "asc" } },
  _count: { select: { assignments: true } },
} satisfies Prisma.SalaryStructureInclude;

export async function GET() {
  try {
    const { schoolId } = await requirePermission("payroll", "view");
    const rows = await prisma.salaryStructure.findMany({
      where: { schoolId },
      include: structureInclude,
      orderBy: { name: "asc" },
    });
    const data = rows.map(({ _count, ...rest }) => ({ ...rest, assignedStaffCount: _count.assignments }));
    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("payroll", "create");
    const { schoolId } = user;
    const input = cleanEmptyStrings(salaryStructureInputSchema.parse(await request.json()));

    const componentIds = input.items.map((i) => i.componentId);
    const components = await prisma.salaryComponent.findMany({ where: { id: { in: componentIds }, schoolId } });
    if (components.length !== new Set(componentIds).size) {
      return NextResponse.json({ error: "One or more selected components could not be found." }, { status: 422 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.salaryStructure.create({
        data: {
          schoolId,
          name: input.name,
          description: input.description,
          status: input.status,
          items: {
            create: input.items.map((item, i) => ({
              componentId: item.componentId,
              amount: item.amount,
              percentage: item.percentage,
              sortOrder: i,
            })),
          },
        },
        include: structureInclude,
      });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "salaryStructure.create",
        entityType: "SalaryStructure",
        entityId: row.id,
        after: row,
      });
      return row;
    });

    const { _count, ...rest } = created;
    return NextResponse.json({ ...rest, assignedStaffCount: _count.assignments }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
