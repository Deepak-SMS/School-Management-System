import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { ATTENDANCE_STATUSES, PRESENT_STATUSES, ABSENT_STATUSES } from "@/lib/constants/attendance";
import { apiError } from "@/lib/api-error";

function emptyStatusCounts(): Record<string, number> {
  return Object.fromEntries(ATTENDANCE_STATUSES.map((s) => [s, 0]));
}

/** null (not 0) when nobody's been marked — a report row with no data is "—", not a 0% defaulter. */
function percentage(present: number, total: number): number | null {
  return total > 0 ? Math.round((present / total) * 100) : null;
}

/**
 * A class/section's attendance over a date range, one row per student —
 * fills ATTENDANCE-ROADMAP.md §6 phase 4's "Class Reports" (date-range/
 * class/section picker, export). Daily by default (`subjectId` omitted);
 * pass `subjectId` for a period-wise report instead.
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("studentAttendance", "view");
    const params = request.nextUrl.searchParams;
    const classId = params.get("classId");
    const sectionId = params.get("sectionId");
    const subjectId = params.get("subjectId");
    const from = params.get("from");
    const to = params.get("to");
    if (!classId || !sectionId || !from || !to) {
      return NextResponse.json({ error: "classId, sectionId, from and to are required." }, { status: 400 });
    }

    const [cls, section, subject] = await Promise.all([
      prisma.class.findFirst({ where: { id: classId, schoolId }, select: { id: true, name: true } }),
      prisma.section.findFirst({ where: { id: sectionId, schoolId }, select: { id: true, name: true } }),
      subjectId
        ? prisma.subject.findFirst({ where: { id: subjectId, schoolId }, select: { id: true, name: true } })
        : Promise.resolve(null),
    ]);
    if (!cls || !section) return NextResponse.json({ error: "Class or section not found." }, { status: 404 });

    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDateEnd = new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000);

    const [students, records] = await Promise.all([
      prisma.student.findMany({
        where: { schoolId, classId, sectionId, status: "active" },
        select: { id: true, firstName: true, lastName: true, rollNumber: true },
        orderBy: [{ rollNumber: "asc" }, { firstName: "asc" }],
      }),
      prisma.attendance.findMany({
        where: { schoolId, classId, sectionId, subjectId: subjectId || null, date: { gte: fromDate, lt: toDateEnd } },
        select: { studentId: true, status: true, date: true },
      }),
    ]);

    const byStudent = new Map<string, Record<string, number>>();
    for (const r of records) {
      const bucket = byStudent.get(r.studentId) ?? emptyStatusCounts();
      bucket[r.status] = (bucket[r.status] ?? 0) + 1;
      byStudent.set(r.studentId, bucket);
    }

    const rows = students.map((s) => {
      const counts = byStudent.get(s.id) ?? emptyStatusCounts();
      const present = PRESENT_STATUSES.reduce((sum, st) => sum + (counts[st] ?? 0), 0);
      const absent = ABSENT_STATUSES.reduce((sum, st) => sum + (counts[st] ?? 0), 0);
      const total = present + absent;
      return {
        studentId: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        rollNumber: s.rollNumber,
        byStatus: counts,
        present,
        absent,
        total,
        pct: percentage(present, total),
      };
    });

    const daysMarked = new Set(records.map((r) => r.date.toISOString().slice(0, 10))).size;
    const classTotal = rows.reduce((sum, r) => sum + r.total, 0);
    const classPresent = rows.reduce((sum, r) => sum + r.present, 0);

    return NextResponse.json({
      class: cls,
      section,
      subject,
      from,
      to,
      daysMarked,
      summary: { studentCount: rows.length, avgPct: percentage(classPresent, classTotal) },
      rows,
    });
  } catch (error) {
    return apiError(error);
  }
}
