import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { ACTIVE_EMPLOYMENT_STATUSES } from "@/lib/constants/hr";
import { apiError } from "@/lib/api-error";

/**
 * Every dropdown the HR forms and filter panels need, in one request.
 *
 * Mirrors the existing `/api/school-structure` pattern: a form would otherwise
 * fire five parallel requests just to render its selects. Returns only active
 * rows — inactive masters stay valid on existing records but are not offered for
 * new ones.
 */
export async function GET() {
  try {
    const { schoolId } = await requirePermission("employees", "view");

    const [departments, designations, employeeTypes, campuses, managers] = await Promise.all([
      prisma.department.findMany({
        where: { schoolId, status: "active" },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      }),
      prisma.designation.findMany({
        where: { schoolId, status: "active" },
        select: { id: true, name: true, code: true, departmentId: true, level: true },
        orderBy: [{ level: "desc" }, { name: "asc" }],
      }),
      prisma.employeeType.findMany({
        where: { schoolId, status: "active" },
        select: { id: true, name: true, code: true, isPaid: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.campus.findMany({
        where: { schoolId, status: "active" },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      }),
      // Anyone currently employed can be a reporting manager; the employee's own
      // record is filtered out client-side when editing, to avoid self-reporting.
      prisma.staff.findMany({
        where: { schoolId, employmentStatus: { in: [...ACTIVE_EMPLOYMENT_STATUSES] } },
        select: { id: true, fullName: true, employeeId: true },
        orderBy: { fullName: "asc" },
      }),
    ]);

    return NextResponse.json({ departments, designations, employeeTypes, campuses, managers });
  } catch (error) {
    return apiError(error);
  }
}
