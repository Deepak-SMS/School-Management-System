import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { PRESENT_STATUSES, ABSENT_STATUSES } from "@/lib/constants/attendance";
import { ATTENDANCE_SETTINGS_DEFAULTS } from "@/lib/validation/attendance-settings";
import { apiError } from "@/lib/api-error";

/**
 * Every active student whose attendance % (daily, over the date range —
 * defaults to the active academic year to date) falls below the school's
 * warning threshold, worst first. `AttendanceSettings.warningThreshold`/
 * `criticalThreshold` classify the tier; see ATTENDANCE-ROADMAP.md §6 phase 6.
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("studentAttendance", "view");
    const params = request.nextUrl.searchParams;
    const classId = params.get("classId") || undefined;

    const [settings, activeYear] = await Promise.all([
      prisma.attendanceSettings.upsert({
        where: { schoolId },
        create: { schoolId, ...ATTENDANCE_SETTINGS_DEFAULTS },
        update: {},
      }),
      prisma.academicYear.findFirst({ where: { schoolId, status: "active" }, select: { startDate: true } }),
    ]);

    const from = params.get("from") ?? activeYear?.startDate.toISOString().slice(0, 10);
    const to = params.get("to") ?? new Date().toISOString().slice(0, 10);
    if (!from) {
      return NextResponse.json({ error: "No active academic year — pass ?from= explicitly." }, { status: 400 });
    }

    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDateEnd = new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000);

    const [students, records] = await Promise.all([
      prisma.student.findMany({
        where: { schoolId, status: "active", ...(classId && { classId }) },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          rollNumber: true,
          class: { select: { name: true } },
          section: { select: { name: true } },
        },
      }),
      prisma.attendance.groupBy({
        by: ["studentId", "status"],
        where: { schoolId, subjectId: null, date: { gte: fromDate, lt: toDateEnd }, ...(classId && { classId }) },
        _count: { _all: true },
      }),
    ]);

    const byStudent = new Map<string, Record<string, number>>();
    for (const r of records) {
      const bucket = byStudent.get(r.studentId) ?? {};
      bucket[r.status] = (bucket[r.status] ?? 0) + r._count._all;
      byStudent.set(r.studentId, bucket);
    }

    const rows = students
      .map((s) => {
        const counts = byStudent.get(s.id) ?? {};
        const present = PRESENT_STATUSES.reduce((sum, st) => sum + (counts[st] ?? 0), 0);
        const absent = ABSENT_STATUSES.reduce((sum, st) => sum + (counts[st] ?? 0), 0);
        const total = present + absent;
        const pct = total > 0 ? Math.round((present / total) * 100) : null;
        return {
          studentId: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
          rollNumber: s.rollNumber,
          className: s.class.name,
          sectionName: s.section?.name ?? null,
          present,
          absent,
          total,
          pct,
        };
      })
      .filter((r): r is typeof r & { pct: number } => r.pct !== null && r.pct < settings.warningThreshold)
      .map((r) => ({ ...r, tier: r.pct < settings.criticalThreshold ? ("critical" as const) : ("warning" as const) }))
      .sort((a, b) => a.pct - b.pct);

    return NextResponse.json({
      from,
      to,
      warningThreshold: settings.warningThreshold,
      criticalThreshold: settings.criticalThreshold,
      rows,
    });
  } catch (error) {
    return apiError(error);
  }
}
