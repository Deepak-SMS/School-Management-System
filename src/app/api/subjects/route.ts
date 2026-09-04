import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { subjectInputSchema } from "@/lib/validation/subject";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  try {
  const { schoolId } = await requirePermission("subjects", "view");
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 20)));
  const q = params.get("q")?.trim();
  const subjectType = params.get("subjectType") ?? undefined;
  const status = params.get("status") ?? undefined;
  const academicYearId = params.get("academicYearId") ?? undefined;
  const classId = params.get("classId") ?? undefined;

  const where: Prisma.SubjectWhereInput = {
    schoolId,
    ...(subjectType && { subjectType }),
    ...(status && { status }),
    ...(q && { OR: [{ name: { contains: q } }, { code: { contains: q } }] }),
    ...((academicYearId || classId) && {
      assignments: { some: { ...(academicYearId && { academicYearId }), ...(classId && { classId }) } },
    }),
  };

  const [subjects, total] = await Promise.all([
    prisma.subject.findMany({ where, orderBy: { name: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.subject.count({ where }),
  ]);

  const data = await Promise.all(
    subjects.map(async (subject) => {
      const [assignments, timetableSlots, attendanceRecords, libraryBooks] = await Promise.all([
        prisma.subjectAssignment.findMany({ where: { subjectId: subject.id }, select: { classId: true, teacherId: true } }),
        prisma.timetableSlot.count({ where: { subjectId: subject.id } }),
        prisma.attendance.count({ where: { subjectId: subject.id } }),
        prisma.libraryBook.count({ where: { subjectId: subject.id } }),
      ]);
      const classes = new Set(assignments.map((a) => a.classId)).size;
      const teachers = new Set(assignments.map((a) => a.teacherId).filter((id): id is string => Boolean(id))).size;
      // Mirrors the DELETE route's own in-use check — lets the table offer
      // "Deactivate" up front instead of trying a delete that's going to be
      // refused (see src/app/api/subjects/[id]/route.ts).
      const deletable = assignments.length === 0 && timetableSlots === 0 && attendanceRecords === 0 && libraryBooks === 0;
      return { ...subject, counts: { classes, teachers }, deletable };
    }),
  );

  return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("subjects", "create");
    const body = await request.json();
    const input = cleanEmptyStrings(subjectInputSchema.parse(body));

    const subject = await prisma.$transaction(async (tx) => {
      const created = await tx.subject.create({
        data: {
          schoolId,
          name: input.name,
          code: input.code,
          subjectType: input.subjectType,
          description: input.description,
          natureType: input.natureType,
          maxMarks: input.maxMarks,
          passingMarks: input.passingMarks,
          credits: input.credits,
          gradingSystem: input.gradingSystem,
          status: input.status,
        },
      });
      await recordAudit(tx, { schoolId, action: "subject.create", entityType: "Subject", entityId: created.id, after: created });
      return created;
    });

    return NextResponse.json(subject, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
