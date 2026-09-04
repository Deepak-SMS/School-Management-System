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
  assignments: {
    where: { effectiveTo: null },
    include: { staff: { select: { id: true, fullName: true, employeeId: true } } },
  },
  _count: { select: { assignments: true } },
} satisfies Prisma.SalaryStructureInclude;

function serialize<T extends { _count: { assignments: number } }>({ _count, ...rest }: T) {
  return { ...rest, assignedStaffCount: _count.assignments };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("payroll", "view");
    const { id } = await params;

    const structure = await prisma.salaryStructure.findFirst({ where: { id, schoolId }, include: structureInclude });
    if (!structure) return NextResponse.json({ error: "Salary structure not found." }, { status: 404 });
    return NextResponse.json(serialize(structure));
  } catch (error) {
    return apiError(error);
  }
}

/** Replaces the item list wholesale on every edit — simpler and safer than diffing, and structures are edited far less often than payroll runs. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("payroll", "edit");
    const { schoolId } = user;
    const { id } = await params;
    const input = cleanEmptyStrings(salaryStructureInputSchema.parse(await request.json()));

    const existing = await prisma.salaryStructure.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Salary structure not found." }, { status: 404 });

    const componentIds = input.items.map((i) => i.componentId);
    const components = await prisma.salaryComponent.findMany({ where: { id: { in: componentIds }, schoolId } });
    if (components.length !== new Set(componentIds).size) {
      return NextResponse.json({ error: "One or more selected components could not be found." }, { status: 422 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.salaryStructureItem.deleteMany({ where: { structureId: id } });
      const row = await tx.salaryStructure.update({
        where: { id },
        data: {
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
        action: "salaryStructure.update",
        entityType: "SalaryStructure",
        entityId: id,
        before: existing,
        after: row,
      });
      return row;
    });

    return NextResponse.json(serialize(updated));
  } catch (error) {
    return apiError(error);
  }
}

/** Deactivates rather than deletes if any staff member has ever been assigned this structure. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("payroll", "delete");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.salaryStructure.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Salary structure not found." }, { status: 404 });

    const inUse = await prisma.salaryStructureAssignment.count({ where: { structureId: id } });

    const result = await prisma.$transaction(async (tx) => {
      if (inUse > 0) {
        const row = await tx.salaryStructure.update({ where: { id }, data: { status: "inactive" } });
        await recordAudit(tx, {
          schoolId,
          userId: user.id,
          action: "salaryStructure.deactivate",
          entityType: "SalaryStructure",
          entityId: id,
          before: existing,
          after: row,
        });
        return { deactivated: true, staffEverAssigned: inUse };
      }
      await tx.salaryStructure.delete({ where: { id } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "salaryStructure.delete",
        entityType: "SalaryStructure",
        entityId: id,
        before: existing,
      });
      return { deactivated: false, staffEverAssigned: 0 };
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
