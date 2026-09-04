import { prisma } from "@/lib/db";

const PRESENT_STATUSES = ["present", "late", "half_day", "on_duty", "wfh"];
const ABSENT_STATUSES = ["absent", "unpaid_leave"];

export interface StaffAttendanceFilters {
  schoolId: string;
  departmentId?: string;
  from: Date;
  /** Exclusive upper bound. */
  to: Date;
}

export interface StaffAttendanceOverview {
  totalMarked: number;
  present: number;
  absent: number;
  onLeave: number;
  attendancePct: number;
  dailyTrend: { date: string; present: number; absent: number }[];
  belowThreshold: { staffId: string; name: string; designation: string | null; pct: number; presentDays: number; totalDays: number }[];
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getStaffAttendanceOverview(f: StaffAttendanceFilters & { thresholdPct?: number }): Promise<StaffAttendanceOverview> {
  const where = {
    schoolId: f.schoolId,
    date: { gte: f.from, lt: f.to },
    ...(f.departmentId && { staff: { departmentId: f.departmentId } }),
  };

  const rows = await prisma.staffAttendance.findMany({ where, select: { date: true, status: true, staffId: true } });

  const present = rows.filter((r) => PRESENT_STATUSES.includes(r.status)).length;
  const absent = rows.filter((r) => ABSENT_STATUSES.includes(r.status)).length;
  const onLeave = rows.filter((r) => r.status === "paid_leave").length;
  const totalMarked = rows.length;

  const trendByDay = new Map<string, { present: number; absent: number }>();
  for (const row of rows) {
    const key = dateKey(row.date);
    const bucket = trendByDay.get(key) ?? { present: 0, absent: 0 };
    if (PRESENT_STATUSES.includes(row.status)) bucket.present += 1;
    else if (ABSENT_STATUSES.includes(row.status)) bucket.absent += 1;
    trendByDay.set(key, bucket);
  }
  const dailyTrend = [...trendByDay.entries()].map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date));

  const byStaff = new Map<string, { present: number; total: number }>();
  for (const row of rows) {
    const bucket = byStaff.get(row.staffId) ?? { present: 0, total: 0 };
    bucket.total += 1;
    if (PRESENT_STATUSES.includes(row.status)) bucket.present += 1;
    byStaff.set(row.staffId, bucket);
  }
  const threshold = f.thresholdPct ?? 75;
  const belowCandidates = [...byStaff.entries()]
    .map(([staffId, v]) => ({ staffId, ...v, pct: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0 }))
    .filter((s) => s.total > 0 && s.pct < threshold);

  const staffRecords = belowCandidates.length
    ? await prisma.staff.findMany({ where: { id: { in: belowCandidates.map((c) => c.staffId) } }, select: { id: true, fullName: true, designation: { select: { name: true } } } })
    : [];
  const staffById = new Map(staffRecords.map((s) => [s.id, s]));

  const belowThreshold = belowCandidates
    .map((c) => {
      const s = staffById.get(c.staffId);
      return { staffId: c.staffId, name: s?.fullName ?? "Unknown", designation: s?.designation?.name ?? null, pct: c.pct, presentDays: c.present, totalDays: c.total };
    })
    .sort((a, b) => a.pct - b.pct);

  return {
    totalMarked,
    present,
    absent,
    onLeave,
    attendancePct: totalMarked > 0 ? Math.round((present / totalMarked) * 100) : 0,
    dailyTrend,
    belowThreshold,
  };
}
