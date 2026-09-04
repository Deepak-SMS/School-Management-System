import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { resolveScopedAcademicYear } from "@/lib/admissions/academic-year-scope";
import { ENQUIRY_STATUSES, APPLICATION_STATUSES } from "@/lib/constants/admissions";
import { apiError } from "@/lib/api-error";

/**
 * The admissions funnel for a year: where enquiries and applications stand,
 * which sources and counsellors convert, and how many seats each class has
 * filled. Enquiries and applications have no academicYearId of their own
 * (they exist before a student is placed), so — like the overview endpoint —
 * both are scoped by the year's date range instead.
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("studentRegistrations", "view");
    const params = request.nextUrl.searchParams;
    const academicYear = await resolveScopedAcademicYear(schoolId, params.get("academicYearId"));

    if (!academicYear) {
      return NextResponse.json({
        academicYearId: null,
        funnel: [],
        enquiries: { total: 0, byStatus: [], bySource: [], byCounsellor: [] },
        applications: { total: 0, byStatus: [] },
        admittedByClass: [],
      });
    }

    const dateRange = { gte: academicYear.startDate, lte: academicYear.endDate };
    const enquiryWhere = { schoolId, createdAt: dateRange };
    const registrationWhere = { schoolId, submittedAt: dateRange };

    const [
      enquiryStatusGroups,
      enquirySourceGroups,
      enquirySourceConvertedGroups,
      enquiryCounsellorGroups,
      enquiryCounsellorConvertedGroups,
      registrationStatusGroups,
      classGroups,
    ] = await Promise.all([
      prisma.admissionEnquiry.groupBy({ by: ["status"], where: enquiryWhere, _count: { _all: true } }),
      prisma.admissionEnquiry.groupBy({ by: ["source"], where: enquiryWhere, _count: { _all: true } }),
      prisma.admissionEnquiry.groupBy({
        by: ["source"],
        where: { ...enquiryWhere, status: "converted" },
        _count: { _all: true },
      }),
      prisma.admissionEnquiry.groupBy({
        by: ["assignedToId"],
        where: { ...enquiryWhere, assignedToId: { not: null } },
        _count: { _all: true },
      }),
      prisma.admissionEnquiry.groupBy({
        by: ["assignedToId"],
        where: { ...enquiryWhere, assignedToId: { not: null }, status: "converted" },
        _count: { _all: true },
      }),
      prisma.studentRegistration.groupBy({ by: ["status"], where: registrationWhere, _count: { _all: true } }),
      prisma.student.groupBy({
        by: ["classId"],
        where: { schoolId, academicYearId: academicYear.id },
        _count: { _all: true },
      }),
    ]);

    const staffIds = enquiryCounsellorGroups.map((g) => g.assignedToId).filter((id): id is string => Boolean(id));
    const staff = staffIds.length
      ? await prisma.staff.findMany({ where: { id: { in: staffIds } }, select: { id: true, fullName: true } })
      : [];
    const staffNameById = new Map(staff.map((s) => [s.id, s.fullName]));

    const classIds = classGroups.map((g) => g.classId);
    const classes = classIds.length
      ? await prisma.class.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true } })
      : [];
    const classNameById = new Map(classes.map((c) => [c.id, c.name]));

    const enquiryTotal = enquiryStatusGroups.reduce((sum, g) => sum + g._count._all, 0);
    const registrationTotal = registrationStatusGroups.reduce((sum, g) => sum + g._count._all, 0);

    const convertedBySource = new Map(enquirySourceConvertedGroups.map((g) => [g.source, g._count._all]));
    const convertedByCounsellor = new Map(
      enquiryCounsellorConvertedGroups.map((g) => [g.assignedToId, g._count._all]),
    );

    const registrationCount = (status: string) =>
      registrationStatusGroups.find((g) => g.status === status)?._count._all ?? 0;

    const funnel = [
      { label: "Enquiries", count: enquiryTotal },
      { label: "Applications", count: registrationTotal },
      { label: "Shortlisted", count: registrationCount("shortlisted") },
      { label: "Approved", count: registrationCount("approved") },
    ];

    return NextResponse.json({
      academicYearId: academicYear.id,
      funnel,
      enquiries: {
        total: enquiryTotal,
        byStatus: ENQUIRY_STATUSES.map((status) => ({
          status,
          count: enquiryStatusGroups.find((g) => g.status === status)?._count._all ?? 0,
        })),
        bySource: enquirySourceGroups
          .map((g) => ({
            source: g.source,
            count: g._count._all,
            converted: convertedBySource.get(g.source) ?? 0,
          }))
          .sort((a, b) => b.count - a.count),
        byCounsellor: enquiryCounsellorGroups
          .map((g) => ({
            staffId: g.assignedToId as string,
            staffName: staffNameById.get(g.assignedToId as string) ?? "Unknown",
            count: g._count._all,
            converted: convertedByCounsellor.get(g.assignedToId) ?? 0,
          }))
          .sort((a, b) => b.count - a.count),
      },
      applications: {
        total: registrationTotal,
        byStatus: APPLICATION_STATUSES.map((status) => ({ status, count: registrationCount(status) })),
      },
      admittedByClass: classGroups
        .map((g) => ({
          classId: g.classId,
          className: classNameById.get(g.classId) ?? "Unknown",
          count: g._count._all,
        }))
        .sort((a, b) => a.className.localeCompare(b.className)),
    });
  } catch (error) {
    return apiError(error);
  }
}
