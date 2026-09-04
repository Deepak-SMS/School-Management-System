import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { resolvePortalStudent } from "@/lib/portal-scope";
import { apiError } from "@/lib/api-error";

/** A student/parent's own section's published timetable — same shape as src/app/api/my/timetable/route.ts (the teacher-scoped equivalent). */
export async function GET(request: NextRequest) {
  try {
    await requirePermission("timetable", "view");
    const { studentId } = await resolvePortalStudent(request.nextUrl.searchParams.get("studentId"));

    const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { sectionId: true } });
    if (!student.sectionId) return NextResponse.json({ data: [] });

    const slots = await prisma.timetableSlot.findMany({
      where: { sectionId: student.sectionId, timetable: { status: "published" } },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, fullName: true } },
        room: { select: { id: true, name: true } },
        period: { select: { id: true, label: true, startTime: true, endTime: true, sortOrder: true } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { period: { sortOrder: "asc" } }],
    });

    return NextResponse.json({ data: slots });
  } catch (error) {
    return apiError(error);
  }
}
