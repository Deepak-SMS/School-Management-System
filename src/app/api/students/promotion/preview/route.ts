import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import { suggestTargetClass, suggestActionFor } from "@/lib/students/promotion";

/**
 * Everything the promotion workspace needs in one call: each source-year class
 * with its active roster and a suggested target class, plus the full list of
 * target-year classes/sections to populate the mapping dropdowns. School-scale
 * data (~1,000 students), so loading it all at once is the same tradeoff
 * /api/student-fees and /api/students/import/commit already make.
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("students", "promote");
    const params = request.nextUrl.searchParams;
    const sourceAcademicYearId = params.get("sourceAcademicYearId");
    const targetAcademicYearId = params.get("targetAcademicYearId");

    if (!sourceAcademicYearId || !targetAcademicYearId) {
      return NextResponse.json({ error: "sourceAcademicYearId and targetAcademicYearId are required." }, { status: 400 });
    }
    if (sourceAcademicYearId === targetAcademicYearId) {
      return NextResponse.json({ error: "Source and target academic year must be different." }, { status: 400 });
    }

    const [sourceYear, targetYear] = await Promise.all([
      prisma.academicYear.findFirst({ where: { id: sourceAcademicYearId, schoolId }, select: { id: true, label: true } }),
      prisma.academicYear.findFirst({ where: { id: targetAcademicYearId, schoolId }, select: { id: true, label: true } }),
    ]);
    if (!sourceYear) return NextResponse.json({ error: "Source academic year not found." }, { status: 404 });
    if (!targetYear) return NextResponse.json({ error: "Target academic year not found." }, { status: 404 });

    const [sourceClasses, targetClasses] = await Promise.all([
      prisma.class.findMany({
        where: { schoolId, academicYearId: sourceAcademicYearId },
        orderBy: [{ campusId: "asc" }, { sortOrder: "asc" }],
        select: { id: true, name: true, code: true, sortOrder: true, campusId: true },
      }),
      prisma.class.findMany({
        where: { schoolId, academicYearId: targetAcademicYearId },
        orderBy: [{ campusId: "asc" }, { sortOrder: "asc" }],
        select: {
          id: true,
          name: true,
          sortOrder: true,
          campusId: true,
          sections: { select: { id: true, name: true }, orderBy: { name: "asc" } },
        },
      }),
    ]);

    const students = await prisma.student.findMany({
      where: { schoolId, academicYearId: sourceAcademicYearId, status: "active", classId: { in: sourceClasses.map((c) => c.id) } },
      orderBy: [{ rollNumber: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNumber: true,
        rollNumber: true,
        classId: true,
        sectionId: true,
        section: { select: { name: true } },
      },
    });

    const classes = sourceClasses.map((cls) => {
      const suggested = suggestTargetClass(cls, targetClasses);
      const roster = students.filter((s) => s.classId === cls.id);
      return {
        id: cls.id,
        name: cls.name,
        code: cls.code,
        sortOrder: cls.sortOrder,
        campusId: cls.campusId,
        studentCount: roster.length,
        suggestedAction: suggestActionFor(suggested),
        suggestedTargetClassId: suggested?.id ?? null,
        students: roster.map((s) => ({
          id: s.id,
          fullName: [s.firstName, s.lastName].filter(Boolean).join(" "),
          admissionNumber: s.admissionNumber,
          rollNumber: s.rollNumber,
          sectionId: s.sectionId,
          sectionName: s.section?.name ?? null,
        })),
      };
    });

    return NextResponse.json({
      sourceYear,
      targetYear,
      targetClasses: targetClasses.map((c) => ({
        id: c.id,
        name: c.name,
        sortOrder: c.sortOrder,
        campusId: c.campusId,
        sections: c.sections,
      })),
      classes,
    });
  } catch (error) {
    return apiError(error);
  }
}
