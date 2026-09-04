import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { salaryComponentInputSchema } from "@/lib/validation/salary-component";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { apiError } from "@/lib/api-error";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("payroll", "edit");
    const { schoolId } = user;
    const { id } = await params;
    const input = cleanEmptyStrings(salaryComponentInputSchema.partial().parse(await request.json()));

    const existing = await prisma.salaryComponent.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Salary component not found." }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.salaryComponent.update({ where: { id }, data: input });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "salaryComponent.update",
        entityType: "SalaryComponent",
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

/** Deactivates rather than deletes if any structure already includes this component. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("payroll", "delete");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.salaryComponent.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Salary component not found." }, { status: 404 });

    const inUse = await prisma.salaryStructureItem.count({ where: { componentId: id } });

    const result = await prisma.$transaction(async (tx) => {
      if (inUse > 0) {
        const row = await tx.salaryComponent.update({ where: { id }, data: { status: "inactive" } });
        await recordAudit(tx, {
          schoolId,
          userId: user.id,
          action: "salaryComponent.deactivate",
          entityType: "SalaryComponent",
          entityId: id,
          before: existing,
          after: row,
        });
        return { deactivated: true, structuresUsingComponent: inUse };
      }
      await tx.salaryComponent.delete({ where: { id } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "salaryComponent.delete",
        entityType: "SalaryComponent",
        entityId: id,
        before: existing,
      });
      return { deactivated: false, structuresUsingComponent: 0 };
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
