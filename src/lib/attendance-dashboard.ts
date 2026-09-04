import { prisma } from "@/lib/db";
import { PRESENT_STATUSES, ABSENT_STATUSES } from "@/lib/constants/attendance";

const WEEKLY_TREND_DAYS = 7;

export interface AttendanceTrendPoint {
  date: string;
  present: number;
  absent: number;
}

export interface AttendanceClassRow {
  classId: string;
  className: string;
  totalActive: number;
  markedCount: number;
  present: number;
  notMarked: number;
  /** null when nobody in the class has been marked yet today. */
  pct: number | null;
}

export interface AttendanceOverview {
  today: { present: number; absent: number; notMarked: number; totalActive: number; marked: boolean };
  weekly: AttendanceTrendPoint[];
  byClass: AttendanceClassRow[];
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Shared by the general `/admin` Dashboard's attendance widget (today + weekly
 * trend + a by-class breakdown limited to classes marked today) and the
 * dedicated `/academics/attendance` page (`includeUnmarkedClasses: true` widens
 * that breakdown to every active class, surfacing the ones nobody has marked yet).
 */
export async function getAttendanceOverview(
  schoolId: string,
  opts: { includeUnmarkedClasses?: boolean } = {},
): Promise<AttendanceOverview> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const weekStart = new Date(todayStart.getTime() - (WEEKLY_TREND_DAYS - 1) * 24 * 60 * 60 * 1000);

  const [activeStudentCount, todayRows, weekRows, classRows] = await Promise.all([
    prisma.student.count({ where: { schoolId, status: "active" } }),
    prisma.attendance.groupBy({
      by: ["status"],
      where: { schoolId, subjectId: null, date: { gte: todayStart, lt: todayEnd } },
      _count: { _all: true },
    }),
    prisma.attendance.findMany({
      where: { schoolId, subjectId: null, date: { gte: weekStart, lt: todayEnd } },
      select: { date: true, status: true },
    }),
    prisma.attendance.groupBy({
      by: ["classId", "status"],
      where: { schoolId, subjectId: null, date: { gte: todayStart, lt: todayEnd } },
      _count: { _all: true },
    }),
  ]);

  const statusCount = (status: string) => todayRows.find((r) => r.status === status)?._count._all ?? 0;
  const present = PRESENT_STATUSES.reduce((sum, s) => sum + statusCount(s), 0);
  const absent = ABSENT_STATUSES.reduce((sum, s) => sum + statusCount(s), 0);
  const marked = todayRows.reduce((sum, r) => sum + r._count._all, 0);

  const trendByDay = new Map<string, { present: number; absent: number }>();
  for (const row of weekRows) {
    const key = dateKey(row.date);
    const bucket = trendByDay.get(key) ?? { present: 0, absent: 0 };
    if (PRESENT_STATUSES.includes(row.status as (typeof PRESENT_STATUSES)[number])) bucket.present += 1;
    else if (ABSENT_STATUSES.includes(row.status as (typeof ABSENT_STATUSES)[number])) bucket.absent += 1;
    trendByDay.set(key, bucket);
  }
  const weekly = Array.from({ length: WEEKLY_TREND_DAYS }, (_, i) => {
    const d = new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000);
    const key = dateKey(d);
    const bucket = trendByDay.get(key) ?? { present: 0, absent: 0 };
    return { date: key, present: bucket.present, absent: bucket.absent };
  });

  const classIdsWithRows = [...new Set(classRows.map((r) => r.classId))];
  const [namedClasses, activeByClass] = await Promise.all([
    opts.includeUnmarkedClasses
      ? prisma.class.findMany({ where: { schoolId, status: "active" }, select: { id: true, name: true, sortOrder: true }, orderBy: { sortOrder: "asc" } })
      : classIdsWithRows.length
        ? prisma.class.findMany({ where: { id: { in: classIdsWithRows } }, select: { id: true, name: true, sortOrder: true }, orderBy: { sortOrder: "asc" } })
        : Promise.resolve([]),
    opts.includeUnmarkedClasses
      ? prisma.student.groupBy({ by: ["classId"], where: { schoolId, status: "active" }, _count: { _all: true } })
      : Promise.resolve([]),
  ]);
  const activeCountOf = (id: string) => activeByClass.find((r) => r.classId === id)?._count._all ?? 0;

  // Follows the same class ordering the Classes list itself uses (Class.sortOrder),
  // not alphabetical — a name-sort would put "Class 10" before "Class 2".
  const classIds = namedClasses.map((c) => c.id);
  const byClass = classIds.map((classId) => {
    const rows = classRows.filter((r) => r.classId === classId);
    const markedCount = rows.reduce((sum, r) => sum + r._count._all, 0);
    const presentCount = rows
      .filter((r) => PRESENT_STATUSES.includes(r.status as (typeof PRESENT_STATUSES)[number]))
      .reduce((sum, r) => sum + r._count._all, 0);
    const totalActive = opts.includeUnmarkedClasses ? activeCountOf(classId) : markedCount;
    return {
      classId,
      className: namedClasses.find((c) => c.id === classId)?.name ?? "Unassigned",
      totalActive,
      markedCount,
      present: presentCount,
      notMarked: Math.max(0, totalActive - markedCount),
      pct: markedCount > 0 ? Math.round((presentCount / markedCount) * 100) : null,
    };
  });

  return {
    today: {
      present,
      absent,
      notMarked: Math.max(0, activeStudentCount - marked),
      totalActive: activeStudentCount,
      marked: marked > 0,
    },
    weekly,
    byClass,
  };
}
