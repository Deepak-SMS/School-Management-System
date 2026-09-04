import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { WEEKDAYS } from "@/lib/constants/school";

/**
 * Which days the school actually works.
 *
 * Everything downstream reads this: attendance won't mark anyone absent on a
 * holiday, leave only consumes days the school was open, and payroll's
 * "22 working days" comes from here. Getting it wrong doesn't produce a visible
 * error — it silently pays people the wrong amount — so the rules live in one
 * place with the reasoning attached.
 */

type Db = PrismaClient | Prisma.TransactionClient;

/** Midnight UTC for a date, which is how every date column here is stored. */
export function dayKey(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function parseDay(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Every date from `from` to `to` inclusive. */
export function eachDay(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  for (let d = dayKey(from); d <= dayKey(to); d = new Date(d.getTime() + 86400000)) {
    days.push(new Date(d));
  }
  return days;
}

export interface DayInfo {
  date: Date;
  isWorkingDay: boolean;
  /** Why not, when it isn't: "weekly_off" or the holiday's name. */
  reason?: string;
  holidayName?: string;
}

export interface CalendarContext {
  /** Weekday names the school is normally open, lowercase. */
  workingWeekdays: Set<string>;
  holidays: {
    startDate: Date;
    endDate: Date;
    name: string;
    appliesTo: string;
    campusId: string | null;
    isWorkingDay: boolean;
  }[];
}

/**
 * Loads the calendar rules once for a date range.
 *
 * A school that hasn't configured its week yet falls back to Monday–Saturday,
 * which is the norm for Indian schools — Monday–Friday would silently under-count
 * a working month by four or five days.
 */
export async function loadCalendar(db: Db, schoolId: string, from: Date, to: Date): Promise<CalendarContext> {
  const [school, holidays] = await Promise.all([
    db.school.findUnique({ where: { id: schoolId }, select: { workingDaysJson: true } }),
    db.holiday.findMany({
      where: { schoolId, startDate: { lte: dayKey(to) }, endDate: { gte: dayKey(from) } },
      select: {
        startDate: true,
        endDate: true,
        name: true,
        appliesTo: true,
        campusId: true,
        isWorkingDay: true,
      },
    }),
  ]);

  let workingWeekdays: string[] = [];
  try {
    const parsed = school?.workingDaysJson ? JSON.parse(school.workingDaysJson) : null;
    if (Array.isArray(parsed) && parsed.length > 0) {
      workingWeekdays = parsed.filter((d): d is string => typeof d === "string").map((d) => d.toLowerCase());
    }
  } catch {
    // A malformed setting must not stop attendance being marked.
    workingWeekdays = [];
  }

  if (workingWeekdays.length === 0) {
    workingWeekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  }

  return { workingWeekdays: new Set(workingWeekdays), holidays };
}

export interface StaffCalendarScope {
  /** "teaching" or "non_teaching", derived from the employee's category. */
  group?: string;
  campusId?: string | null;
}

/**
 * Whether one date is a working day for one employee.
 *
 * Order matters: a special working day (`isWorkingDay`) overrides the weekly
 * off, which is exactly what it's for — a school opening on a Sunday for an
 * exam. Only then does an ordinary holiday apply.
 */
export function describeDay(date: Date, calendar: CalendarContext, scope: StaffCalendarScope = {}): DayInfo {
  const key = dayKey(date);
  const weekday = WEEKDAYS[(key.getUTCDay() + 6) % 7]; // getUTCDay: 0 = Sunday

  const applicable = calendar.holidays.filter((h) => {
    if (key < dayKey(h.startDate) || key > dayKey(h.endDate)) return false;
    if (h.campusId && scope.campusId && h.campusId !== scope.campusId) return false;
    if (h.appliesTo !== "all" && scope.group && h.appliesTo !== scope.group) return false;
    return true;
  });

  const specialWorking = applicable.find((h) => h.isWorkingDay);
  if (specialWorking) {
    return { date: key, isWorkingDay: true, reason: specialWorking.name };
  }

  const holiday = applicable.find((h) => !h.isWorkingDay);
  if (holiday) {
    return { date: key, isWorkingDay: false, reason: "holiday", holidayName: holiday.name };
  }

  if (!calendar.workingWeekdays.has(weekday)) {
    return { date: key, isWorkingDay: false, reason: "weekly_off" };
  }

  return { date: key, isWorkingDay: true };
}

/** Working days in a range, for one employee. This is payroll's denominator. */
export function countWorkingDays(from: Date, to: Date, calendar: CalendarContext, scope: StaffCalendarScope = {}): number {
  return eachDay(from, to).filter((d) => describeDay(d, calendar, scope).isWorkingDay).length;
}

/** The month's first and last day, as UTC midnights. */
export function monthRange(year: number, month: number): { from: Date; to: Date } {
  return {
    from: new Date(Date.UTC(year, month - 1, 1)),
    to: new Date(Date.UTC(year, month, 0)),
  };
}

/** Teaching or non-teaching, from the employee's category. */
export function staffGroup(category: string): "teaching" | "non_teaching" {
  return category === "teacher" || category === "principal" ? "teaching" : "non_teaching";
}
