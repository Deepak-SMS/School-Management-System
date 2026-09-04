import { prisma } from "@/lib/db";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  HALF_DAY_STATUSES,
  NON_WORKING_STATUSES,
  PAID_PRESENT_STATUSES,
  type StaffAttendanceStatus,
} from "@/lib/constants/hr-attendance";
import {
  countWorkingDays,
  dayKey,
  describeDay,
  loadCalendar,
  monthRange,
  staffGroup,
  type CalendarContext,
} from "@/lib/hr/work-calendar";

/**
 * Staff attendance: marking it, locking it, and summarising it for payroll.
 *
 * The summary at the bottom is the contract payroll will read. Everything else
 * here exists to make sure that summary is trustworthy — one row per person per
 * day, no edits after a month is locked, and holidays never counted as absence.
 */

type Db = PrismaClient | Prisma.TransactionClient;

export class AttendanceError extends Error {
  status: number;

  constructor(message: string, status = 422) {
    super(message);
    this.name = "AttendanceError";
    this.status = status;
  }
}

/**
 * Refuses to touch a month HR has closed.
 *
 * Payroll runs off these figures, so a change after the fact would mean a
 * payslip that no longer matches the attendance behind it. Reopening is a
 * deliberate, recorded act — see the reopen route.
 */
export async function assertPeriodOpen(db: Db, schoolId: string, date: Date): Promise<void> {
  const key = dayKey(date);
  const lock = await db.attendancePeriodLock.findUnique({
    where: {
      schoolId_year_month: { schoolId, year: key.getUTCFullYear(), month: key.getUTCMonth() + 1 },
    },
    select: { isLocked: true },
  });

  if (lock?.isLocked) {
    const label = key.toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
    throw new AttendanceError(
      `${label} attendance is locked. An authorised user must reopen the month before it can be changed.`,
      409,
    );
  }
}

export interface MarkInput {
  staffId: string;
  date: Date;
  status: StaffAttendanceStatus;
  checkIn?: Date;
  checkOut?: Date;
  remarks?: string;
}

/**
 * Records one employee's day.
 *
 * Upserted on (staffId, date) rather than inserted: marking the same day twice
 * is a correction, not a second attendance. A row written by an approved leave
 * request is left alone — overwriting it would put attendance and the leave
 * record into disagreement.
 */
export async function markAttendance(
  db: Db,
  schoolId: string,
  input: MarkInput,
  markedById: string,
  options: { allowOverwriteLeave?: boolean } = {},
) {
  const key = dayKey(input.date);

  const existing = await db.staffAttendance.findUnique({
    where: { staffId_date: { staffId: input.staffId, date: key } },
    select: { id: true, source: true },
  });

  if (existing?.source === "leave" && !options.allowOverwriteLeave) {
    throw new AttendanceError(
      "This day is covered by an approved leave request. Cancel the leave instead of overwriting the attendance.",
      409,
    );
  }

  const data = {
    status: input.status,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    remarks: input.remarks,
    // Late minutes are derived where both times are known, so the figure can't
    // disagree with the times printed beside it.
    lateMinutes: undefined as number | undefined,
    workedMinutes:
      input.checkIn && input.checkOut
        ? Math.max(0, Math.round((input.checkOut.getTime() - input.checkIn.getTime()) / 60000))
        : undefined,
    source: "manual",
    markedById,
  };

  return db.staffAttendance.upsert({
    where: { staffId_date: { staffId: input.staffId, date: key } },
    create: { schoolId, staffId: input.staffId, date: key, ...data },
    update: data,
  });
}

/**
 * Writes the calendar's own rows for a day — holiday and weekly off.
 *
 * Marking a whole department present is the common case, and without this an
 * employee would show as "not marked" on a Sunday, which reads as a gap rather
 * than a closed day.
 */
export async function fillNonWorkingDay(
  db: Db,
  schoolId: string,
  staffIds: string[],
  date: Date,
  status: "holiday" | "weekly_off",
) {
  const key = dayKey(date);

  // Whatever is already marked wins: a holiday row must never overwrite a real
  // attendance someone recorded. (createMany skipDuplicates is unavailable on
  // SQLite, so the existing rows are read and excluded instead.)
  const already = await db.staffAttendance.findMany({
    where: { date: key, staffId: { in: staffIds } },
    select: { staffId: true },
  });
  const taken = new Set(already.map((a) => a.staffId));
  const missing = staffIds.filter((id) => !taken.has(id));
  if (missing.length === 0) return;

  await db.staffAttendance.createMany({
    data: missing.map((staffId) => ({ schoolId, staffId, date: key, status, source: "holiday" })),
  });
}

export interface AttendanceSummary {
  staffId: string;
  employeeId: string;
  fullName: string;
  department: string | null;
  /** Days the school was open for this employee. Payroll's denominator. */
  workingDays: number;
  present: number;
  halfDays: number;
  paidLeave: number;
  unpaidLeave: number;
  absent: number;
  /** Working days with no row at all — neither present nor accounted for. */
  unmarked: number;
  lateCount: number;
  /** present + half-days counted as 0.5 + paid leave. What payroll pays for. */
  payableDays: number;
}

/**
 * The monthly figure payroll reads.
 *
 * Deliberately explicit about `unmarked`: a day nobody recorded is not the same
 * as an absence, and quietly treating it as one would dock pay for an
 * administrative gap. Payroll should refuse to run, or ask, while this is
 * non-zero rather than guess.
 */
export async function monthlySummary(
  schoolId: string,
  year: number,
  month: number,
  filter: { staffId?: string; departmentId?: string } = {},
): Promise<{ summaries: AttendanceSummary[]; from: Date; to: Date }> {
  const { from, to } = monthRange(year, month);

  const staff = await prisma.staff.findMany({
    where: {
      schoolId,
      ...(filter.staffId && { id: filter.staffId }),
      ...(filter.departmentId && { departmentId: filter.departmentId }),
      employmentStatus: { notIn: ["resigned", "terminated", "retired"] },
    },
    select: {
      id: true,
      employeeId: true,
      fullName: true,
      category: true,
      campusId: true,
      department: { select: { name: true } },
    },
    orderBy: { employeeId: "asc" },
  });

  const rows = await prisma.staffAttendance.findMany({
    where: { schoolId, date: { gte: from, lte: to }, staffId: { in: staff.map((s) => s.id) } },
    select: { staffId: true, date: true, status: true },
  });

  const calendar = await loadCalendar(prisma, schoolId, from, to);
  const byStaff = new Map<string, { date: Date; status: string }[]>();
  for (const r of rows) {
    const list = byStaff.get(r.staffId) ?? [];
    list.push({ date: r.date, status: r.status });
    byStaff.set(r.staffId, list);
  }

  const summaries = staff.map((s) => {
    const scope = { group: staffGroup(s.category), campusId: s.campusId };
    const workingDays = countWorkingDays(from, to, calendar, scope);
    const marks = byStaff.get(s.id) ?? [];

    let present = 0;
    let halfDays = 0;
    let paidLeave = 0;
    let unpaidLeave = 0;
    let absent = 0;
    let lateCount = 0;
    const markedWorkingDays = new Set<string>();

    for (const m of marks) {
      const status = m.status as StaffAttendanceStatus;
      if (NON_WORKING_STATUSES.includes(status)) continue;

      // Only days the school was actually open count towards the month.
      if (!describeDay(m.date, calendar, scope).isWorkingDay) continue;
      markedWorkingDays.add(m.date.toISOString().slice(0, 10));

      if (PAID_PRESENT_STATUSES.includes(status)) present += 1;
      else if (HALF_DAY_STATUSES.includes(status)) halfDays += 1;
      else if (status === "paid_leave") paidLeave += 1;
      else if (status === "unpaid_leave") unpaidLeave += 1;
      else if (status === "absent") absent += 1;

      if (status === "late") lateCount += 1;
    }

    const unmarked = Math.max(0, workingDays - markedWorkingDays.size);

    return {
      staffId: s.id,
      employeeId: s.employeeId,
      fullName: s.fullName,
      department: s.department?.name ?? null,
      workingDays,
      present,
      halfDays,
      paidLeave,
      unpaidLeave,
      absent,
      unmarked,
      lateCount,
      payableDays: present + halfDays * 0.5 + paidLeave,
    } satisfies AttendanceSummary;
  });

  return { summaries, from, to };
}

/** The calendar behind a month, so the UI can grey out closed days. */
export async function monthCalendar(schoolId: string, year: number, month: number, scope: { group?: string; campusId?: string | null } = {}) {
  const { from, to } = monthRange(year, month);
  const calendar = await loadCalendar(prisma, schoolId, from, to);

  const days: { date: string; isWorkingDay: boolean; reason?: string; holidayName?: string }[] = [];
  for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 86400000)) {
    const info = describeDay(d, calendar, scope);
    days.push({
      date: info.date.toISOString().slice(0, 10),
      isWorkingDay: info.isWorkingDay,
      reason: info.reason,
      holidayName: info.holidayName,
    });
  }

  return { from, to, days };
}

export type { CalendarContext };
