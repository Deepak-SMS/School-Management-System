import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit, recordStaffActivity, describeChange } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

/** Staff assigned to this department, for the department's Employees list. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("departments", "view");
    const { id } = await params;

    const department = await prisma.department.findFirst({
      where: { id, schoolId },
      select: { id: true, name: true, headStaffId: true },
    });
    if (!department) return NextResponse.json({ error: "Department not found." }, { status: 404 });

    const staff = await prisma.staff.findMany({
      where: { schoolId, departmentId: id },
      select: {
        id: true,
        fullName: true,
        employeeId: true,
        category: true,
        employmentStatus: true,
        mobileNumber: true,
        email: true,
        designation: { select: { id: true, name: true } },
        employeeTypeRef: { select: { id: true, name: true } },
      },
      orderBy: { fullName: "asc" },
    });

    return NextResponse.json({
      department,
      data: staff.map(({ designation, employeeTypeRef, ...rest }) => ({
        ...rest,
        designation: designation?.name ?? "",
        employeeType: employeeTypeRef?.name ?? null,
        isHead: department.headStaffId === rest.id,
      })),
      total: staff.length,
    });
  } catch (error) {
    return apiError(error);
  }
}

const assignSchema = z.object({
  /** Existing employees to move into this department. */
  staffIds: z.array(z.string().trim().min(1)).min(1, "Select at least one employee").max(200),
});

/**
 * Moves existing employees into this department.
 *
 * An employee belongs to exactly one department, so this reassigns rather than
 * adds — and each move is written to that employee's activity timeline, since
 * "which department was I in last term" is a question schools actually ask.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("employees", "edit");
    const { schoolId } = user;
    const { id } = await params;

    const department = await prisma.department.findFirst({
      where: { id, schoolId },
      select: { id: true, name: true },
    });
    if (!department) return NextResponse.json({ error: "Department not found." }, { status: 404 });

    const input = assignSchema.parse(await request.json());

    // Every id must belong to this school — otherwise a guessed id could pull
    // another tenant's employee into this department.
    const staff = await prisma.staff.findMany({
      where: { schoolId, id: { in: input.staffIds } },
      select: { id: true, fullName: true, departmentId: true, department: { select: { name: true } } },
    });
    if (staff.length !== input.staffIds.length) {
      return NextResponse.json({ error: "One or more employees were not found." }, { status: 404 });
    }

    const moved = staff.filter((s) => s.departmentId !== id);

    await prisma.$transaction(async (tx) => {
      for (const person of moved) {
        await tx.staff.update({ where: { id: person.id }, data: { departmentId: id } });

        await recordAudit(tx, {
          schoolId,
          userId: user.id,
          action: "employee.department_change",
          entityType: "Staff",
          entityId: person.id,
          before: { department: person.department?.name ?? null },
          after: { department: department.name },
        });
        await recordStaffActivity(tx, {
          schoolId,
          staffId: person.id,
          type: "department_changed",
          description: describeChange("Department", person.department?.name ?? null, department.name),
          actorId: user.id,
        });
      }
    });

    return NextResponse.json({
      success: true,
      moved: moved.length,
      alreadyHere: staff.length - moved.length,
    });
  } catch (error) {
    return apiError(error);
  }
}
