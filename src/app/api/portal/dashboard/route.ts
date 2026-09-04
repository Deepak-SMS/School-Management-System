import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, currentUserCan } from "@/lib/authorize";
import { resolvePortalStudent } from "@/lib/portal-scope";
import { studentFeeChargeInclude, buildStudentFeeAccount } from "@/lib/student-fee-response";
import { apiError } from "@/lib/api-error";

const PRESENT_STATUSES = ["present", "late", "half_day"];

/**
 * One aggregated call for the dashboard's stat tiles — attendance this month,
 * next scheduled class, fees due (parent only), and certificate count. Each
 * figure reuses the same query/computation as its own dedicated widget route
 * (see /api/portal/attendance, /timetable, /fees, /certificates) rather than
 * introducing a second way to compute any of them.
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission("studentAttendance", "view");
    const { studentId, role } = await resolvePortalStudent(request.nextUrl.searchParams.get("studentId"));

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const todayName = now.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();

    const [attendanceRecords, student, certificateCount, canViewFees] = await Promise.all([
      prisma.attendance.findMany({
        where: { studentId, subjectId: null, date: { gte: monthStart, lt: monthEnd } },
        select: { status: true },
      }),
      prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { sectionId: true } }),
      prisma.certificate.count({ where: { studentId, status: { in: ["generated", "issued"] } } }),
      currentUserCan("studentFees", "view"),
    ]);

    const present = attendanceRecords.filter((r) => PRESENT_STATUSES.includes(r.status)).length;
    const attendancePct =
      attendanceRecords.length > 0 ? Math.round((present / attendanceRecords.length) * 1000) / 10 : null;

    const nextClass = student.sectionId
      ? await prisma.timetableSlot.findFirst({
          where: { sectionId: student.sectionId, dayOfWeek: todayName, timetable: { status: "published" } },
          include: {
            subject: { select: { name: true } },
            period: { select: { label: true, startTime: true, endTime: true, sortOrder: true } },
          },
          orderBy: { period: { sortOrder: "asc" } },
        })
      : null;

    let fees: ReturnType<typeof buildStudentFeeAccount>["summary"] | null = null;
    if (role === "parent" && canViewFees) {
      const charges = await prisma.studentFeeCharge.findMany({ where: { studentId }, include: studentFeeChargeInclude });
      fees = buildStudentFeeAccount(charges).summary;
    }

    return NextResponse.json({
      attendance: { totalMarked: attendanceRecords.length, present, attendancePct },
      nextClass,
      fees,
      certificateCount,
    });
  } catch (error) {
    return apiError(error);
  }
}
