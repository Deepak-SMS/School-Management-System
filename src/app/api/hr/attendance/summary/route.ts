import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/db";
import { monthlySummary } from "@/lib/hr/staff-attendance";
import { apiError } from "@/lib/api-error";

/**
 * The monthly attendance figures, per employee.
 *
 * This is the contract payroll will read when it lands: working days, present,
 * paid leave, unpaid leave, and payable days. `unmarked` is reported separately
 * and deliberately — a day nobody recorded is not an absence, and payroll
 * should refuse to run against a month that still has any rather than quietly
 * dock someone for an administrative gap.
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("employeeAttendance", "view");
    const params = request.nextUrl.searchParams;

    const now = new Date();
    const year = Number(params.get("year") ?? now.getUTCFullYear());
    const month = Number(params.get("month") ?? now.getUTCMonth() + 1);

    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "Give a valid year and month." }, { status: 422 });
    }

    const { summaries, from, to } = await monthlySummary(schoolId, year, month, {
      staffId: params.get("staffId") ?? undefined,
      departmentId: params.get("departmentId") ?? undefined,
    });

    const lock = await prisma.attendancePeriodLock.findUnique({
      where: { schoolId_year_month: { schoolId, year, month } },
      select: { isLocked: true, lockedAt: true, reopenedAt: true, reopenReason: true },
    });

    const totals = summaries.reduce(
      (acc, s) => ({
        employees: acc.employees + 1,
        present: acc.present + s.present,
        paidLeave: acc.paidLeave + s.paidLeave,
        unpaidLeave: acc.unpaidLeave + s.unpaidLeave,
        absent: acc.absent + s.absent,
        unmarked: acc.unmarked + s.unmarked,
      }),
      { employees: 0, present: 0, paidLeave: 0, unpaidLeave: 0, absent: 0, unmarked: 0 },
    );

    return NextResponse.json({
      year,
      month,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      locked: lock?.isLocked ?? false,
      lockedAt: lock?.lockedAt ?? null,
      reopenedAt: lock?.reopenedAt ?? null,
      reopenReason: lock?.reopenReason ?? null,
      /** True once every working day of every employee is accounted for. */
      readyForPayroll: totals.unmarked === 0,
      totals,
      data: summaries,
    });
  } catch (error) {
    return apiError(error);
  }
}
