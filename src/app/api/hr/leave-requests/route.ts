import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/db";
import { leaveRequestInputSchema } from "@/lib/validation/hr-attendance";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { applyForLeave, LeaveError } from "@/lib/hr/leave";
import { apiError } from "@/lib/api-error";

/** Leave requests, newest first. */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("staffLeave", "view");
    const params = request.nextUrl.searchParams;

    const status = params.get("status") ?? undefined;
    const staffId = params.get("staffId") ?? undefined;
    const leaveTypeId = params.get("leaveTypeId") ?? undefined;
    const page = Math.max(1, Number(params.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 25)));

    const where = { schoolId, ...(status && { status }), ...(staffId && { staffId }), ...(leaveTypeId && { leaveTypeId }) };

    const [data, total, pending] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        include: {
          leaveType: { select: { id: true, name: true, code: true, isPaid: true } },
          staff: { select: { id: true, employeeId: true, fullName: true, department: { select: { name: true } } } },
        },
        orderBy: { appliedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.leaveRequest.count({ where }),
      prisma.leaveRequest.count({ where: { schoolId, status: "pending" } }),
    ]);

    return NextResponse.json({ data, total, page, pageSize, pendingCount: pending });
  } catch (error) {
    return apiError(error);
  }
}

/**
 * Applies for leave.
 *
 * `staffId` is optional: omitted, it means "me", which is how an employee
 * applies for themselves. Supplying someone else's requires the rights to
 * create a request on their behalf, so an employee cannot file leave in a
 * colleague's name.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("staffLeave", "create");
    const input = cleanEmptyStrings(leaveRequestInputSchema.parse(await request.json()));

    const self = await prisma.staff.findFirst({
      where: { schoolId: user.schoolId, userId: user.id },
      select: { id: true },
    });

    const staffId = input.staffId ?? self?.id;
    if (!staffId) {
      return NextResponse.json(
        { error: "This account isn't linked to an employee record, so it can't apply for leave." },
        { status: 422 },
      );
    }

    if (input.staffId && input.staffId !== self?.id) {
      // Filing on someone else's behalf is an HR action, not an employee one.
      await requirePermission("staffLeave", "edit");
    }

    const created = await applyForLeave(user, { ...input, staffId });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof LeaveError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return apiError(error);
  }
}
