import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/db";
import { markAttendanceSchema } from "@/lib/validation/hr-attendance";
import { assertPeriodOpen, markAttendance, AttendanceError } from "@/lib/hr/staff-attendance";
import { describeDay, loadCalendar, parseDay, staffGroup } from "@/lib/hr/work-calendar";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

/**
 * The day sheet: every employee, what the calendar says about the day, and
 * whatever has been marked so far.
 *
 * Returned together on purpose — marking a day needs to show that it's a
 * holiday before anyone starts ticking boxes.
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("employeeAttendance", "view");
    const params = request.nextUrl.searchParams;

    const dateParam = params.get("date");
    if (!dateParam) return NextResponse.json({ error: "A date is required." }, { status: 400 });
    const date = parseDay(dateParam);

    const departmentId = params.get("departmentId") ?? undefined;
    const q = params.get("q")?.trim();

    const staff = await prisma.staff.findMany({
      where: {
        schoolId,
        ...(departmentId && { departmentId }),
        ...(q && { OR: [{ fullName: { contains: q } }, { employeeId: { contains: q } }] }),
        employmentStatus: { notIn: ["resigned", "terminated", "retired"] },
      },
      select: {
        id: true,
        employeeId: true,
        fullName: true,
        category: true,
        campusId: true,
        department: { select: { id: true, name: true } },
      },
      orderBy: { employeeId: "asc" },
    });

    const [marks, calendar, lock] = await Promise.all([
      prisma.staffAttendance.findMany({
        where: { schoolId, date, staffId: { in: staff.map((s) => s.id) } },
      }),
      loadCalendar(prisma, schoolId, date, date),
      prisma.attendancePeriodLock.findUnique({
        where: {
          schoolId_year_month: {
            schoolId,
            year: date.getUTCFullYear(),
            month: date.getUTCMonth() + 1,
          },
        },
        select: { isLocked: true, lockedAt: true },
      }),
    ]);

    const byStaff = new Map(marks.map((m) => [m.staffId, m]));

    const data = staff.map((s) => {
      const day = describeDay(date, calendar, { group: staffGroup(s.category), campusId: s.campusId });
      const mark = byStaff.get(s.id);
      return {
        staffId: s.id,
        employeeId: s.employeeId,
        fullName: s.fullName,
        department: s.department?.name ?? null,
        isWorkingDay: day.isWorkingDay,
        nonWorkingReason: day.isWorkingDay ? null : (day.holidayName ?? day.reason ?? null),
        attendance: mark
          ? {
              id: mark.id,
              status: mark.status,
              checkIn: mark.checkIn,
              checkOut: mark.checkOut,
              remarks: mark.remarks,
              source: mark.source,
            }
          : null,
      };
    });

    return NextResponse.json({
      date: dateParam,
      locked: lock?.isLocked ?? false,
      lockedAt: lock?.lockedAt ?? null,
      data,
      total: data.length,
    });
  } catch (error) {
    return apiError(error);
  }
}

/** Combines a date with an HH:MM time into the instant to store. */
function at(date: Date, time?: string): Date | undefined {
  if (!time) return undefined;
  const [h, m] = time.split(":").map(Number);
  return new Date(date.getTime() + h * 3600000 + m * 60000);
}

/** Marks a day for one or many employees. */
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("employeeAttendance", "edit");
    const { schoolId } = user;
    const input = markAttendanceSchema.parse(await request.json());
    const date = parseDay(input.date);

    // Refused before anything is written, so a locked month never gets a
    // partial update.
    await assertPeriodOpen(prisma, schoolId, date);

    const staffIds = input.entries.map((e) => e.staffId);
    const staff = await prisma.staff.findMany({
      where: { id: { in: staffIds }, schoolId },
      select: { id: true, fullName: true, category: true, campusId: true },
    });
    if (staff.length !== new Set(staffIds).size) {
      return NextResponse.json({ error: "One or more employees don't belong to this school." }, { status: 422 });
    }

    // A day the school is closed for this employee can't be marked. The monthly
    // summary counts working days only, so a row written here would be stored
    // and then silently ignored — worse than a refusal, because it looks like
    // it worked.
    const calendar = await loadCalendar(prisma, schoolId, date, date);
    const byId = new Map(staff.map((s) => [s.id, s]));
    const closed = input.entries
      .map((e) => byId.get(e.staffId))
      .filter((s): s is (typeof staff)[number] => Boolean(s))
      .filter(
        (s) => !describeDay(date, calendar, { group: staffGroup(s.category), campusId: s.campusId }).isWorkingDay,
      );

    if (closed.length > 0) {
      const day = describeDay(date, calendar, {
        group: staffGroup(closed[0].category),
        campusId: closed[0].campusId,
      });
      const who = closed.length === 1 ? closed[0].fullName : `${closed.length} employees`;
      return NextResponse.json(
        {
          error: `${input.date} isn't a working day (${day.holidayName ?? "weekly off"}), so attendance can't be marked for ${who}.`,
        },
        { status: 422 },
      );
    }

    const results = await prisma.$transaction(async (tx) => {
      const written = [];
      for (const entry of input.entries) {
        written.push(
          await markAttendance(
            tx,
            schoolId,
            {
              staffId: entry.staffId,
              date,
              status: entry.status as never,
              checkIn: at(date, entry.checkIn),
              checkOut: at(date, entry.checkOut),
              remarks: entry.remarks,
            },
            user.id,
          ),
        );
      }

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "hr.attendance.mark",
        entityType: "StaffAttendance",
        entityId: input.date,
        after: { date: input.date, employees: written.length },
      });

      return written;
    });

    return NextResponse.json({ date: input.date, marked: results.length }, { status: 201 });
  } catch (error) {
    if (error instanceof AttendanceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return apiError(error);
  }
}
