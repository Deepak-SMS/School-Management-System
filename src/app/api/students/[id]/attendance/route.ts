import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { ATTENDANCE_STATUSES, PRESENT_STATUSES, ABSENT_STATUSES } from "@/lib/constants/attendance";
import { apiError } from "@/lib/api-error";

/** `present`/`late`/`half_day` all count toward the percentage; `absent`/`leave` don't. */
function percentage(present: number, total: number): number {
  return total > 0 ? Math.round((present / total) * 100) : 0;
}

function emptyStatusCounts(): Record<string, number> {
  return Object.fromEntries(ATTENDANCE_STATUSES.map((s) => [s, 0]));
}

/**
 * One student's attendance summary — daily/homeroom rows (`subjectId = null`)
 * roll up into the headline percentage, period rows roll up per-subject.
 * Same PRESENT_STATUSES/ABSENT_STATUSES split the Dashboard uses, so the
 * numbers agree everywhere they're shown.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("studentAttendance", "view");
    const { id } = await params;
    const requestedYearId = request.nextUrl.searchParams.get("academicYearId") ?? undefined;

    const student = await prisma.student.findFirst({
      where: { id, schoolId },
      select: { id: true, firstName: true, lastName: true, classId: true, sectionId: true },
    });
    if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

    const academicYear = requestedYearId
      ? await prisma.academicYear.findFirst({ where: { id: requestedYearId, schoolId }, select: { id: true, label: true } })
      : await prisma.academicYear.findFirst({ where: { schoolId, status: "active" }, select: { id: true, label: true } });
    if (!academicYear) return NextResponse.json({ error: "Academic year not found." }, { status: 404 });

    const records = await prisma.attendance.findMany({
      where: { schoolId, studentId: id, academicYearId: academicYear.id },
      select: { status: true, subjectId: true, subject: { select: { id: true, name: true, code: true } } },
    });

    const daily = records.filter((r) => !r.subjectId);
    const dailyCounts = emptyStatusCounts();
    for (const r of daily) dailyCounts[r.status] = (dailyCounts[r.status] ?? 0) + 1;
    const dailyPresent = PRESENT_STATUSES.reduce((sum, s) => sum + (dailyCounts[s] ?? 0), 0);
    const dailyAbsent = ABSENT_STATUSES.reduce((sum, s) => sum + (dailyCounts[s] ?? 0), 0);

    const bySubjectMap = new Map<string, { subjectId: string; subjectName: string; subjectCode: string; present: number; absent: number; total: number }>();
    for (const r of records) {
      if (!r.subjectId || !r.subject) continue;
      const bucket = bySubjectMap.get(r.subjectId) ?? {
        subjectId: r.subjectId,
        subjectName: r.subject.name,
        subjectCode: r.subject.code,
        present: 0,
        absent: 0,
        total: 0,
      };
      bucket.total += 1;
      if (PRESENT_STATUSES.includes(r.status as (typeof PRESENT_STATUSES)[number])) bucket.present += 1;
      else if (ABSENT_STATUSES.includes(r.status as (typeof ABSENT_STATUSES)[number])) bucket.absent += 1;
      bySubjectMap.set(r.subjectId, bucket);
    }

    return NextResponse.json({
      student: { id: student.id, firstName: student.firstName, lastName: student.lastName },
      academicYear,
      summary: {
        total: daily.length,
        present: dailyPresent,
        absent: dailyAbsent,
        byStatus: dailyCounts,
        percentage: percentage(dailyPresent, daily.length),
      },
      bySubject: [...bySubjectMap.values()]
        .map((s) => ({ ...s, percentage: percentage(s.present, s.total) }))
        .sort((a, b) => a.subjectName.localeCompare(b.subjectName)),
    });
  } catch (error) {
    return apiError(error);
  }
}
