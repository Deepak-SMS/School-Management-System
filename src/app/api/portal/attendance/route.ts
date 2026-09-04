import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { resolvePortalStudent } from "@/lib/portal-scope";
import { apiError } from "@/lib/api-error";

/** Daily/homeroom attendance only (subjectId null) — same convention as src/lib/ai/analytics/attendance-analytics.ts. */
const PRESENT_STATUSES = ["present", "late", "half_day"];

/** A student/parent's own attendance history for a date range — defaults to the current month. */
export async function GET(request: NextRequest) {
  try {
    await requirePermission("studentAttendance", "view");
    const { studentId } = await resolvePortalStudent(request.nextUrl.searchParams.get("studentId"));

    const now = new Date();
    const fromParam = request.nextUrl.searchParams.get("from");
    const toParam = request.nextUrl.searchParams.get("to");
    const from = fromParam ? new Date(fromParam) : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = toParam ? new Date(toParam) : new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const records = await prisma.attendance.findMany({
      where: { studentId, subjectId: null, date: { gte: from, lt: to } },
      orderBy: { date: "asc" },
      select: { id: true, date: true, status: true, remarks: true },
    });

    const present = records.filter((r) => PRESENT_STATUSES.includes(r.status)).length;
    const attendancePct = records.length > 0 ? Math.round((present / records.length) * 1000) / 10 : null;

    return NextResponse.json({ data: records, summary: { totalMarked: records.length, present, attendancePct } });
  } catch (error) {
    return apiError(error);
  }
}
