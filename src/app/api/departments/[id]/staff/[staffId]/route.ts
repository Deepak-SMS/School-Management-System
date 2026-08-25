import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit, recordStaffActivity, describeChange } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

/**
 * Removes an employee from this department.
 *
 * The employee is not deleted — only their department link is cleared, leaving
 * them unassigned and ready to be placed elsewhere. Deleting people is a
 * separate, deliberately harder action on the employee record itself.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; staffId: string }> },
) {
  try {
    const user = await requirePermission("employees", "edit");
    const { schoolId } = user;
    const { id, staffId } = await params;

    const person = await prisma.staff.findFirst({
      where: { id: staffId, schoolId, departmentId: id },
      select: { id: true, fullName: true, department: { select: { id: true, name: true } } },
    });
    if (!person) {
      return NextResponse.json({ error: "That employee isn't in this department." }, { status: 404 });
    }

    // The department's head can't simply be unassigned — clearing the link would
    // leave the department pointing at someone who is no longer in it.
    const department = await prisma.department.findFirst({
      where: { id, schoolId },
      select: { headStaffId: true, name: true },
    });
    if (department?.headStaffId === staffId) {
      return NextResponse.json(
        { error: `${person.fullName} is the head of ${department.name}. Assign a different head first.` },
        { status: 409 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.staff.update({ where: { id: staffId }, data: { departmentId: null } });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "employee.department_remove",
        entityType: "Staff",
        entityId: staffId,
        before: { department: person.department?.name ?? null },
        after: { department: null },
      });
      await recordStaffActivity(tx, {
        schoolId,
        staffId,
        type: "department_changed",
        description: describeChange("Department", person.department?.name ?? null, null),
        actorId: user.id,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
