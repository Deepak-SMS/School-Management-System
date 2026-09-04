import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { examPatchSchema } from "@/lib/validation/exam";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

const examInclude = {
  academicYear: { select: { id: true, label: true } },
  examType: { select: { id: true, name: true, examCategory: true } },
  classes: {
    include: {
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.ExamInclude;

type ExamWithRelations = Prisma.ExamGetPayload<{ include: typeof examInclude }>;

function serializeExam({ classes, ...rest }: ExamWithRelations) {
  return {
    ...rest,
    classes: classes.map((c) => ({
      id: c.id,
      classId: c.classId,
      className: c.class.name,
      sectionId: c.sectionId,
      sectionName: c.section?.name ?? null,
    })),
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("exams", "view");
    const { id } = await params;

    const exam = await prisma.exam.findFirst({ where: { id, schoolId }, include: examInclude });
    if (!exam) return NextResponse.json({ error: "Exam not found." }, { status: 404 });
    return NextResponse.json(serializeExam(exam));
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("exams", "edit");
    const { schoolId } = user;
    const { id } = await params;
    const input = cleanEmptyStrings(examPatchSchema.parse(await request.json()));

    const existing = await prisma.exam.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Exam not found." }, { status: 404 });

    if (input.code && input.code !== existing.code) {
      const duplicate = await prisma.exam.findFirst({
        where: { schoolId, academicYearId: input.academicYearId ?? existing.academicYearId, code: input.code, id: { not: id } },
      });
      if (duplicate) {
        return NextResponse.json({ error: `An exam with code "${input.code}" already exists for this academic year.` }, { status: 409 });
      }
    }

    const { classes, ...fields } = input;

    const updated = await prisma.$transaction(async (tx) => {
      if (classes) {
        await tx.examClass.deleteMany({ where: { examId: id } });
      }
      const row = await tx.exam.update({
        where: { id },
        data: {
          ...fields,
          startDate: fields.startDate ? new Date(fields.startDate) : undefined,
          endDate: fields.endDate ? new Date(fields.endDate) : undefined,
          resultDate: fields.resultDate ? new Date(fields.resultDate) : undefined,
          ...(classes && { classes: { create: classes.map((c) => ({ classId: c.classId, sectionId: c.sectionId })) } }),
        },
        include: examInclude,
      });
      await recordAudit(tx, { schoolId, userId: user.id, action: "exam.update", entityType: "Exam", entityId: id, before: existing, after: row });
      return row;
    });

    return NextResponse.json(serializeExam(updated));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("exams", "delete");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.exam.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Exam not found." }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.exam.delete({ where: { id } });
      await recordAudit(tx, { schoolId, userId: user.id, action: "exam.delete", entityType: "Exam", entityId: id, before: existing });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
