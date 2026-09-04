import { prisma } from "@/lib/db";

/** Daily/homeroom attendance only (subjectId null) — same convention as the main dashboard (src/app/api/dashboard/route.ts), so these numbers always agree with it. */
const PRESENT_STATUSES = ["present", "late", "half_day"];
const ABSENT_STATUSES = ["absent", "leave"];

export interface AttendanceFilters {
  schoolId: string;
  classId?: string;
  sectionId?: string;
  from: Date;
  /** Exclusive upper bound. */
  to: Date;
}

export interface AttendanceOverview {
  totalMarked: number;
  present: number;
  absent: number;
  attendancePct: number;
  dailyTrend: { date: string; present: number; absent: number }[];
  classWise: { classId: string; className: string; present: number; total: number; pct: number }[];
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function baseWhere(f: AttendanceFilters) {
  return {
    schoolId: f.schoolId,
    subjectId: null,
    date: { gte: f.from, lt: f.to },
    ...(f.classId && { classId: f.classId }),
    ...(f.sectionId && { sectionId: f.sectionId }),
  };
}

export async function getAttendanceOverview(f: AttendanceFilters): Promise<AttendanceOverview> {
  const [rows, classRows] = await Promise.all([
    prisma.attendance.findMany({ where: baseWhere(f), select: { date: true, status: true, classId: true } }),
    prisma.attendance.groupBy({ by: ["classId", "status"], where: baseWhere(f), _count: { _all: true } }),
  ]);

  const present = rows.filter((r) => PRESENT_STATUSES.includes(r.status)).length;
  const absent = rows.filter((r) => ABSENT_STATUSES.includes(r.status)).length;
  const totalMarked = rows.length;

  const trendByDay = new Map<string, { present: number; absent: number }>();
  for (const row of rows) {
    const key = dateKey(row.date);
    const bucket = trendByDay.get(key) ?? { present: 0, absent: 0 };
    if (PRESENT_STATUSES.includes(row.status)) bucket.present += 1;
    else if (ABSENT_STATUSES.includes(row.status)) bucket.absent += 1;
    trendByDay.set(key, bucket);
  }
  const dailyTrend = Array.from(trendByDay.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const classIds = [...new Set(classRows.map((r) => r.classId))];
  const classes = classIds.length ? await prisma.class.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true } }) : [];
  const classNameOf = (id: string) => classes.find((c) => c.id === id)?.name ?? "Unassigned";
  const classWise = classIds
    .map((classId) => {
      const classGroupRows = classRows.filter((r) => r.classId === classId);
      const total = classGroupRows.reduce((sum, r) => sum + r._count._all, 0);
      const presentCount = classGroupRows
        .filter((r) => PRESENT_STATUSES.includes(r.status))
        .reduce((sum, r) => sum + r._count._all, 0);
      return { classId, className: classNameOf(classId), present: presentCount, total, pct: total > 0 ? Math.round((presentCount / total) * 100) : 0 };
    })
    .sort((a, b) => a.className.localeCompare(b.className));

  return {
    totalMarked,
    present,
    absent,
    attendancePct: totalMarked > 0 ? Math.round((present / totalMarked) * 100) : 0,
    dailyTrend,
    classWise,
  };
}

export interface LowAttendanceStudent {
  studentId: string;
  name: string;
  className: string;
  sectionName: string | null;
  presentDays: number;
  totalDays: number;
  pct: number;
}

/** Students whose attendance over the window falls below `thresholdPct` — the real list behind "low attendance" analytics, reports, and the Attendance Warning communication template. */
export async function getLowAttendanceStudents(f: AttendanceFilters & { thresholdPct: number }): Promise<LowAttendanceStudent[]> {
  const rows = await prisma.attendance.groupBy({
    by: ["studentId", "status"],
    where: baseWhere(f),
    _count: { _all: true },
  });

  const byStudent = new Map<string, { present: number; total: number }>();
  for (const row of rows) {
    const bucket = byStudent.get(row.studentId) ?? { present: 0, total: 0 };
    bucket.total += row._count._all;
    if (PRESENT_STATUSES.includes(row.status)) bucket.present += row._count._all;
    byStudent.set(row.studentId, bucket);
  }

  const candidates = [...byStudent.entries()]
    .map(([studentId, { present, total }]) => ({ studentId, present, total, pct: total > 0 ? Math.round((present / total) * 100) : 0 }))
    .filter((s) => s.total > 0 && s.pct < f.thresholdPct);

  if (candidates.length === 0) return [];

  const students = await prisma.student.findMany({
    where: { id: { in: candidates.map((c) => c.studentId) } },
    select: { id: true, firstName: true, lastName: true, class: { select: { name: true } }, section: { select: { name: true } } },
  });
  const studentById = new Map(students.map((s) => [s.id, s]));

  return candidates
    .map((c) => {
      const s = studentById.get(c.studentId);
      return {
        studentId: c.studentId,
        name: s ? `${s.firstName} ${s.lastName}` : "Unknown student",
        className: s?.class.name ?? "—",
        sectionName: s?.section?.name ?? null,
        presentDays: c.present,
        totalDays: c.total,
        pct: c.pct,
      };
    })
    .sort((a, b) => a.pct - b.pct);
}
