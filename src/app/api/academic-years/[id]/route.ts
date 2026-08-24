import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import { academicYearUpdateSchema } from "@/lib/validation/academicYear";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

async function withCounts(schoolId: string, year: { id: string }) {
  const [students, classes, sections, assignments, classTeachers, sectionTeachers] = await Promise.all([
    prisma.student.count({ where: { schoolId, academicYearId: year.id } }),
    prisma.class.count({ where: { schoolId, academicYearId: year.id } }),
    prisma.section.count({ where: { schoolId, academicYearId: year.id } }),
    prisma.subjectAssignment.findMany({ where: { schoolId, academicYearId: year.id }, select: { subjectId: true, teacherId: true } }),
    prisma.class.findMany({ where: { schoolId, academicYearId: year.id, classTeacherId: { not: null } }, select: { classTeacherId: true } }),
    prisma.section.findMany({ where: { schoolId, academicYearId: year.id, classTeacherId: { not: null } }, select: { classTeacherId: true } }),
  ]);
  const subjects = new Set(assignments.map((a) => a.subjectId)).size;
  const teachers = new Set(
    [...assignments.map((a) => a.teacherId), ...classTeachers.map((c) => c.classTeacherId), ...sectionTeachers.map((s) => s.classTeacherId)].filter(
      (id): id is string => Boolean(id),
    ),
  ).size;
  return { ...year, counts: { students, classes, sections, subjects, teachers } };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const schoolId = await getCurrentSchoolId();
  const { id } = await params;
  const year = await prisma.academicYear.findFirst({ where: { id, schoolId } });
  if (!year) return NextResponse.json({ error: "Academic year not found." }, { status: 404 });
  return NextResponse.json(await withCounts(schoolId, year));
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const schoolId = await getCurrentSchoolId();
    const { id } = await params;
    const body = await request.json();
    const input = cleanEmptyStrings(academicYearUpdateSchema.parse(body));

    const existing = await prisma.academicYear.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Academic year not found." }, { status: 404 });

    const year = await prisma.$transaction(async (tx) => {
      if (input.status === "active") {
        await tx.academicYear.updateMany({ where: { schoolId, status: "active", id: { not: id } }, data: { status: "archived" } });
      }

      const updated = await tx.academicYear.update({
        where: { id },
        data: {
          ...input,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          admissionStartDate: input.admissionStartDate ? new Date(input.admissionStartDate) : undefined,
          admissionEndDate: input.admissionEndDate ? new Date(input.admissionEndDate) : undefined,
          promotionDate: input.promotionDate ? new Date(input.promotionDate) : undefined,
          resultPublicationDate: input.resultPublicationDate ? new Date(input.resultPublicationDate) : undefined,
        },
      });
      await recordAudit(tx, {
        schoolId,
        action: "academicYear.update",
        entityType: "AcademicYear",
        entityId: id,
        before: existing,
        after: updated,
      });
      return updated;
    });

    return NextResponse.json(await withCounts(schoolId, year));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const schoolId = await getCurrentSchoolId();
    const { id } = await params;
    const existing = await prisma.academicYear.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Academic year not found." }, { status: 404 });

    const dependents = await prisma.class.count({ where: { academicYearId: id } });
    const students = await prisma.student.count({ where: { academicYearId: id } });
    if (dependents > 0 || students > 0) {
      return NextResponse.json(
        { error: "This academic year has classes or students assigned to it. Archive it instead of deleting." },
        { status: 409 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.academicYear.delete({ where: { id } });
      await recordAudit(tx, { schoolId, action: "academicYear.delete", entityType: "AcademicYear", entityId: id, before: existing });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
