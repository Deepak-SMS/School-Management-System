import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { resolveScopedAcademicYear } from "@/lib/admissions/academic-year-scope";
import { apiError } from "@/lib/api-error";

/**
 * Decision-stage ledger for the Admissions overview page: how many applications
 * are pending/approved/rejected for a year, and how many seats each class has
 * actually admitted. StudentRegistration has no academicYearId of its own (it's
 * parent-submitted, pre-placement), so its counts are scoped by the academic
 * year's date range against `submittedAt` instead.
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("studentRegistrations", "view");
    const params = request.nextUrl.searchParams;
    const academicYear = await resolveScopedAcademicYear(schoolId, params.get("academicYearId"));

    if (!academicYear) {
      return NextResponse.json({ counts: { pending: 0, approved: 0, rejected: 0 }, admittedByClass: [] });
    }

    const submittedRange = { gte: academicYear.startDate, lte: academicYear.endDate };

    const [statusGroups, classGroups] = await Promise.all([
      prisma.studentRegistration.groupBy({
        by: ["status"],
        where: { schoolId, submittedAt: submittedRange },
        _count: { _all: true },
      }),
      prisma.student.groupBy({
        by: ["classId"],
        where: { schoolId, academicYearId: academicYear.id },
        _count: { _all: true },
      }),
    ]);

    const counts = { pending: 0, approved: 0, rejected: 0 };
    for (const g of statusGroups) {
      if (g.status === "pending" || g.status === "approved" || g.status === "rejected") {
        counts[g.status] = g._count._all;
      }
    }

    const classIds = classGroups.map((g) => g.classId);
    const classes = classIds.length
      ? await prisma.class.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true } })
      : [];
    const classNameById = new Map(classes.map((c) => [c.id, c.name]));

    const admittedByClass = classGroups
      .map((g) => ({
        classId: g.classId,
        className: classNameById.get(g.classId) ?? "Unknown",
        count: g._count._all,
      }))
      .sort((a, b) => a.className.localeCompare(b.className));

    return NextResponse.json({ counts, admittedByClass, academicYearId: academicYear.id });
  } catch (error) {
    return apiError(error);
  }
}
