import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { employeeTypeInputSchema } from "@/lib/validation/employeeType";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("employeeTypes", "edit");
    const { schoolId } = user;
    const { id } = await params;
    const input = cleanEmptyStrings(employeeTypeInputSchema.partial().parse(await request.json()));

    const existing = await prisma.employeeType.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Employee type not found." }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.employeeType.update({ where: { id }, data: input });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "employeeType.update",
        entityType: "EmployeeType",
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

/**
 * Deactivates rather than deletes when employees still reference the type —
 * removing it would strip employment type from historical records that payroll
 * and reporting depend on.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("employeeTypes", "delete");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.employeeType.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Employee type not found." }, { status: 404 });

    const inUse = await prisma.staff.count({ where: { schoolId, employeeTypeId: id } });

    const result = await prisma.$transaction(async (tx) => {
      if (inUse > 0) {
        const row = await tx.employeeType.update({ where: { id }, data: { status: "inactive" } });
        await recordAudit(tx, {
          schoolId,
          userId: user.id,
          action: "employeeType.deactivate",
          entityType: "EmployeeType",
          entityId: id,
          before: existing,
          after: row,
        });
        return { deactivated: true, employees: inUse };
      }

      await tx.employeeType.delete({ where: { id } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "employeeType.delete",
        entityType: "EmployeeType",
        entityId: id,
        before: existing,
      });
      return { deactivated: false, employees: 0 };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return apiError(error);
  }
}
