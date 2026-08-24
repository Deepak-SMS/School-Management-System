import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import { academicYearInputSchema, copyConfigSchema } from "@/lib/validation/academicYear";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

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

export async function GET(request: NextRequest) {
  const schoolId = await getCurrentSchoolId();
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 20)));
  const q = params.get("q")?.trim();
  const status = params.get("status") ?? undefined;

  const where: Prisma.AcademicYearWhereInput = {
    schoolId,
    ...(status && { status }),
    ...(q && { label: { contains: q } }),
  };

  const [years, total] = await Promise.all([
    prisma.academicYear.findMany({ where, orderBy: { startDate: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.academicYear.count({ where }),
  ]);

  const data = await Promise.all(years.map((year) => withCounts(schoolId, year)));
  return NextResponse.json({ data, total, page, pageSize });
}

export async function POST(request: NextRequest) {
  try {
    const schoolId = await getCurrentSchoolId();
    const body = await request.json();
    const { copyConfig: rawCopyConfig, ...rest } = body;
    const input = cleanEmptyStrings(academicYearInputSchema.parse(rest));
    const copyConfig = rawCopyConfig ? copyConfigSchema.parse(rawCopyConfig) : null;

    const year = await prisma.$transaction(async (tx) => {
      if (input.status === "active") {
        await tx.academicYear.updateMany({ where: { schoolId, status: "active" }, data: { status: "archived" } });
      }

      const created = await tx.academicYear.create({
        data: {
          schoolId,
          label: input.label,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          admissionStartDate: input.admissionStartDate ? new Date(input.admissionStartDate) : undefined,
          admissionEndDate: input.admissionEndDate ? new Date(input.admissionEndDate) : undefined,
          promotionDate: input.promotionDate ? new Date(input.promotionDate) : undefined,
          resultPublicationDate: input.resultPublicationDate ? new Date(input.resultPublicationDate) : undefined,
          status: input.status,
        },
      });

      if (copyConfig?.sourceAcademicYearId) {
        const sourceClasses = await tx.class.findMany({ where: { schoolId, academicYearId: copyConfig.sourceAcademicYearId } });
        const classIdMap = new Map<string, string>();

        if (copyConfig.copyClasses) {
          for (const sourceClass of sourceClasses) {
            const newClass = await tx.class.create({
              data: {
                schoolId,
                academicYearId: created.id,
                campusId: sourceClass.campusId,
                name: sourceClass.name,
                code: sourceClass.code,
                sortOrder: sourceClass.sortOrder,
                capacity: sourceClass.capacity,
                classTeacherId: sourceClass.classTeacherId,
                gradingSystem: sourceClass.gradingSystem,
                status: sourceClass.status,
              },
            });
            classIdMap.set(sourceClass.id, newClass.id);
          }
        }

        const sectionIdMap = new Map<string, string>();
        if (copyConfig.copySections && classIdMap.size > 0) {
          const sourceSections = await tx.section.findMany({ where: { schoolId, classId: { in: [...classIdMap.keys()] } } });
          for (const sourceSection of sourceSections) {
            const newClassId = classIdMap.get(sourceSection.classId);
            if (!newClassId) continue;
            const newSection = await tx.section.create({
              data: {
                schoolId,
                classId: newClassId,
                academicYearId: created.id,
                campusId: sourceSection.campusId,
                name: sourceSection.name,
                code: sourceSection.code,
                room: sourceSection.room,
                classTeacherId: sourceSection.classTeacherId,
                capacity: sourceSection.capacity,
                status: sourceSection.status,
              },
            });
            sectionIdMap.set(sourceSection.id, newSection.id);
          }
        }

        if (copyConfig.copySubjects && classIdMap.size > 0) {
          const sourceAssignments = await tx.subjectAssignment.findMany({
            where: { schoolId, academicYearId: copyConfig.sourceAcademicYearId, classId: { in: [...classIdMap.keys()] } },
          });
          for (const assignment of sourceAssignments) {
            const newClassId = classIdMap.get(assignment.classId);
            if (!newClassId) continue;
            const newSectionId = assignment.sectionId ? sectionIdMap.get(assignment.sectionId) : undefined;
            await tx.subjectAssignment.create({
              data: {
                schoolId,
                subjectId: assignment.subjectId,
                academicYearId: created.id,
                classId: newClassId,
                sectionId: newSectionId ?? null,
                teacherId: copyConfig.copyTeacherAssignments ? assignment.teacherId : null,
              },
            });
          }
        }
      }

      await recordAudit(tx, { schoolId, action: "academicYear.create", entityType: "AcademicYear", entityId: created.id, after: created });
      return created;
    });

    return NextResponse.json(await withCounts(schoolId, year), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
