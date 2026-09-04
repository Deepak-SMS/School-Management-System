import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit, recordStaffActivity } from "@/lib/audit";
import { salaryStructureAssignmentInputSchema } from "@/lib/validation/salary-structure";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { apiError } from "@/lib/api-error";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("payroll", "view");
    const { id } = await params;

    const data = await prisma.salaryStructureAssignment.findMany({
      where: { staffId: id, schoolId },
      include: { structure: { select: { id: true, name: true } } },
      orderBy: { effectiveFrom: "desc" },
    });
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}

/**
 * Assigns a new salary structure effective from a date — closes out whatever
 * assignment was current (`effectiveTo: null`) by setting its `effectiveTo`
 * to the day before, then creates the new row. The old assignment is never
 * edited in place, matching StaffTransfer's "history via a new row" shape.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("payroll", "edit");
    const { schoolId } = user;
    const { id } = await params;

    const staff = await prisma.staff.findFirst({ where: { id, schoolId } });
    if (!staff) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

    const input = cleanEmptyStrings(salaryStructureAssignmentInputSchema.parse(await request.json()));

    const structure = await prisma.salaryStructure.findFirst({ where: { id: input.structureId, schoolId } });
    if (!structure) return NextResponse.json({ error: "Salary structure not found." }, { status: 404 });

    const effectiveFrom = new Date(input.effectiveFrom);
    const dayBefore = new Date(effectiveFrom);
    dayBefore.setDate(dayBefore.getDate() - 1);

    const created = await prisma.$transaction(async (tx) => {
      const current = await tx.salaryStructureAssignment.findFirst({ where: { staffId: id, schoolId, effectiveTo: null } });
      if (current) {
        await tx.salaryStructureAssignment.update({ where: { id: current.id }, data: { effectiveTo: dayBefore } });
      }

      const row = await tx.salaryStructureAssignment.create({
        data: { schoolId, staffId: id, structureId: input.structureId, effectiveFrom, createdById: user.id },
        include: { structure: { select: { id: true, name: true } } },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "salaryStructureAssignment.create",
        entityType: "Staff",
        entityId: id,
        before: current ? { structureId: current.structureId } : null,
        after: { structureId: input.structureId },
      });
      await recordStaffActivity(tx, {
        schoolId,
        staffId: id,
        type: "salary_structure_assigned",
        description: `Assigned to salary structure "${structure.name}" effective ${input.effectiveFrom}`,
        actorId: user.id,
      });

      return row;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
