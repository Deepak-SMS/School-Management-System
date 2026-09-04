import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";

/** One student's daily (homeroom) attendance for a single month — the data behind the Attendance Calendar's month grid. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("studentAttendance", "view");
    const { id } = await params;

    const now = new Date();
    const monthParam = request.nextUrl.searchParams.get("month");
    const match = monthParam?.match(/^(\d{4})-(\d{2})$/);
    const year = match ? Number(match[1]) : now.getFullYear();
    const monthIndex = match ? Number(match[2]) - 1 : now.getMonth();

    const student = await prisma.student.findFirst({
      where: { id, schoolId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

    const monthStart = new Date(Date.UTC(year, monthIndex, 1));
    const monthEnd = new Date(Date.UTC(year, monthIndex + 1, 1));

    const records = await prisma.attendance.findMany({
      where: { schoolId, studentId: id, subjectId: null, date: { gte: monthStart, lt: monthEnd } },
      select: { date: true, status: true, remarks: true },
      orderBy: { date: "asc" },
    });

    return NextResponse.json({
      student,
      month: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
      days: records.map((r) => ({ date: r.date.toISOString().slice(0, 10), status: r.status, remarks: r.remarks })),
    });
  } catch (error) {
    return apiError(error);
  }
}
