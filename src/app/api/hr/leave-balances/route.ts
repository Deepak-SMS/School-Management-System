import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/db";
import { leaveBalances } from "@/lib/hr/leave";
import { apiError } from "@/lib/api-error";

/** One employee's leave balances for a year. Defaults to the caller's own. */
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("staffLeave", "view");
    const params = request.nextUrl.searchParams;
    const year = Number(params.get("year") ?? new Date().getUTCFullYear());

    const self = await prisma.staff.findFirst({
      where: { schoolId: user.schoolId, userId: user.id },
      select: { id: true },
    });
    const staffId = params.get("staffId") ?? self?.id;

    if (!staffId) {
      return NextResponse.json(
        { error: "This account isn't linked to an employee record." },
        { status: 422 },
      );
    }

    const staff = await prisma.staff.findFirst({
      where: { id: staffId, schoolId: user.schoolId },
      select: { id: true, employeeId: true, fullName: true },
    });
    if (!staff) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

    const data = await leaveBalances(user.schoolId, staffId, year);
    return NextResponse.json({ staff, year, data });
  } catch (error) {
    return apiError(error);
  }
}
