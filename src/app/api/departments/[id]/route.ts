import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { departmentInputSchema } from "@/lib/validation/department";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

/**
 * These routes previously resolved only the school and never checked the
 * caller's role, so any signed-in user — a teacher, a parent — could rename or
 * delete a department. Every handler now goes through `requirePermission()`,
 * which also supplies the acting user for the audit trail.
 */

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("departments", "view");
    const { id } = await params;

    const department = await prisma.department.findFirst({
      where: { id, schoolId },
      include: { head: { select: { id: true, fullName: true } }, campus: { select: { id: true, name: true } } },
    });
    if (!department) return NextResponse.json({ error: "Department not found." }, { status: 404 });

    const [employees, teachers] = await Promise.all([
      prisma.staff.count({ where: { departmentId: id } }),
      prisma.staff.count({ where: { departmentId: id, category: "teacher" } }),
    ]);
    return NextResponse.json({ ...department, counts: { employees, teachers } });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("departments", "edit");
    const { schoolId } = user;
    const { id } = await params;
    const body = await request.json();
    const input = cleanEmptyStrings(departmentInputSchema.partial().parse(body));

    const existing = await prisma.department.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Department not found." }, { status: 404 });

    // A head must actually be staff at this school, or the department would
    // point at someone who doesn't exist here.
    if (input.headStaffId) {
      const head = await prisma.staff.findFirst({
        where: { id: input.headStaffId, schoolId },
        select: { id: true },
      });
      if (!head) return NextResponse.json({ error: "That head of department was not found." }, { status: 404 });
    }

    const department = await prisma.$transaction(async (tx) => {
      const updated = await tx.department.update({ where: { id }, data: input });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "department.update",
        entityType: "Department",
        entityId: id,
        before: existing,
        after: updated,
      });
      return updated;
    });

    return NextResponse.json(department);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("departments", "delete");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.department.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Department not found." }, { status: 404 });

    // Deleting a department with staff would orphan their employment history,
    // so it's refused — the caller deactivates instead.
    const staffCount = await prisma.staff.count({ where: { departmentId: id } });
    if (staffCount > 0) {
      return NextResponse.json(
        { error: "This department has staff assigned to it. Deactivate it instead of deleting." },
        { status: 409 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.department.delete({ where: { id } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "department.delete",
        entityType: "Department",
        entityId: id,
        before: existing,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
