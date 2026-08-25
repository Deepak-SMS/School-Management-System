import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit, recordStaffActivity, describeChange } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

/**
 * Moves a person in the organisation chart — dropping them under a manager, or
 * into a department.
 *
 * `null` is meaningful here and distinct from omitting the field: null detaches
 * (no manager / no department), omitting leaves it alone. That's what lets a
 * drop onto the canvas root promote someone to the top.
 */
const moveSchema = z.object({
  reportingManagerId: z.string().trim().nullable().optional(),
  departmentId: z.string().trim().nullable().optional(),
});

/**
 * Walks up the reporting line to see whether `managerId` already reports to
 * `staffId`. Without this, dragging a manager under their own subordinate would
 * create a loop that never renders and never resolves.
 */
async function wouldCreateCycle(schoolId: string, staffId: string, managerId: string): Promise<boolean> {
  if (staffId === managerId) return true;

  const staff = await prisma.staff.findMany({
    where: { schoolId },
    select: { id: true, reportingManagerId: true },
  });
  const parentOf = new Map(staff.map((s) => [s.id, s.reportingManagerId]));

  let cursor: string | null | undefined = managerId;
  // Bounded by the number of staff, so a pre-existing loop can't hang this.
  for (let hops = 0; cursor && hops <= staff.length; hops++) {
    if (cursor === staffId) return true;
    cursor = parentOf.get(cursor) ?? null;
  }
  return false;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("employees", "edit");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.staff.findFirst({
      where: { id, schoolId },
      include: {
        department: { select: { id: true, name: true } },
        reportingManager: { select: { id: true, fullName: true } },
      },
    });
    if (!existing) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

    const input = moveSchema.parse(await request.json());

    let managerName: string | null = null;
    if (input.reportingManagerId) {
      const manager = await prisma.staff.findFirst({
        where: { id: input.reportingManagerId, schoolId },
        select: { id: true, fullName: true },
      });
      if (!manager) return NextResponse.json({ error: "That manager was not found." }, { status: 404 });

      if (await wouldCreateCycle(schoolId, id, input.reportingManagerId)) {
        return NextResponse.json(
          {
            error: `${manager.fullName} already reports to ${existing.fullName}, directly or indirectly. That would make the reporting line loop back on itself.`,
          },
          { status: 409 },
        );
      }
      managerName = manager.fullName;
    }

    let departmentName: string | null = null;
    if (input.departmentId) {
      const department = await prisma.department.findFirst({
        where: { id: input.departmentId, schoolId },
        select: { id: true, name: true },
      });
      if (!department) return NextResponse.json({ error: "Department not found." }, { status: 404 });
      departmentName = department.name;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.staff.update({
        where: { id },
        data: {
          ...(input.reportingManagerId !== undefined && { reportingManagerId: input.reportingManagerId }),
          ...(input.departmentId !== undefined && { departmentId: input.departmentId }),
        },
      });

      if (input.reportingManagerId !== undefined && existing.reportingManagerId !== row.reportingManagerId) {
        await recordStaffActivity(tx, {
          schoolId,
          staffId: id,
          type: "profile_updated",
          description: describeChange("Reporting manager", existing.reportingManager?.fullName ?? null, managerName),
          actorId: user.id,
        });
      }

      if (input.departmentId !== undefined && existing.departmentId !== row.departmentId) {
        await recordStaffActivity(tx, {
          schoolId,
          staffId: id,
          type: "department_changed",
          description: describeChange("Department", existing.department?.name ?? null, departmentName),
          actorId: user.id,
        });
      }

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "organization.move",
        entityType: "Staff",
        entityId: id,
        before: {
          reportingManager: existing.reportingManager?.fullName ?? null,
          department: existing.department?.name ?? null,
        },
        after: { reportingManager: managerName, department: departmentName },
      });

      return row;
    });

    return NextResponse.json({
      success: true,
      id: updated.id,
      reportingManagerId: updated.reportingManagerId,
      departmentId: updated.departmentId,
    });
  } catch (error) {
    return apiError(error);
  }
}
