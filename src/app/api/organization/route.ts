import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { ACTIVE_EMPLOYMENT_STATUSES } from "@/lib/constants/hr";
import { apiError } from "@/lib/api-error";

/**
 * The school's organisation chart: departments, the people in them, and who
 * reports to whom.
 *
 * Returned flat rather than pre-nested — the client builds the tree, which keeps
 * this endpoint simple and lets the UI re-parent a node optimistically without
 * refetching the whole structure.
 */
export async function GET() {
  try {
    const { schoolId } = await requirePermission("employees", "view");

    const [departments, staff, memberships] = await Promise.all([
      prisma.department.findMany({
        where: { schoolId },
        select: { id: true, name: true, code: true, departmentType: true, headStaffId: true, status: true },
        orderBy: { name: "asc" },
      }),
      prisma.staff.findMany({
        where: { schoolId, employmentStatus: { in: [...ACTIVE_EMPLOYMENT_STATUSES] } },
        select: {
          id: true,
          fullName: true,
          employeeId: true,
          category: true,
          employmentStatus: true,
          departmentId: true,
          reportingManagerId: true,
          userId: true,
          designation: { select: { name: true } },
        },
        orderBy: { fullName: "asc" },
      }),
      // Role lives on the membership, so it's joined in rather than duplicated
      // onto Staff.
      prisma.schoolMembership.findMany({
        where: { schoolId },
        select: { userId: true, role: true, user: { select: { email: true, isActive: true } } },
      }),
    ]);

    const roleByUserId = new Map(memberships.map((m) => [m.userId, m]));

    return NextResponse.json({
      departments,
      people: staff.map((s) => {
        const membership = s.userId ? roleByUserId.get(s.userId) : undefined;
        return {
          id: s.id,
          name: s.fullName,
          employeeId: s.employeeId,
          category: s.category,
          employmentStatus: s.employmentStatus,
          departmentId: s.departmentId,
          reportingManagerId: s.reportingManagerId,
          designation: s.designation?.name ?? null,
          // Null when this employee has no login yet — the chart shows that as
          // "no access" rather than implying they can sign in.
          access: membership
            ? { role: membership.role, email: membership.user.email, isActive: membership.user.isActive }
            : null,
        };
      }),
    });
  } catch (error) {
    return apiError(error);
  }
}
