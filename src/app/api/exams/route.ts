import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { examInputSchema } from "@/lib/validation/exam";
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

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("exams", "view");
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 20)));
    const q = params.get("q")?.trim();
    const academicYearId = params.get("academicYearId") ?? undefined;
    const status = params.get("status") ?? undefined;

    const where: Prisma.ExamWhereInput = {
      schoolId,
      ...(academicYearId && { academicYearId }),
      ...(status && { status }),
      ...(q && { OR: [{ name: { contains: q } }, { code: { contains: q } }] }),
    };

    const [rows, total] = await Promise.all([
      prisma.exam.findMany({
        where,
        include: examInclude,
        orderBy: [{ startDate: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.exam.count({ where }),
    ]);

    return NextResponse.json({ data: rows.map(serializeExam), total, page, pageSize });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("exams", "create");
    const { schoolId } = user;
    const input = cleanEmptyStrings(examInputSchema.parse(await request.json()));

    const duplicate = await prisma.exam.findFirst({
      where: { schoolId, academicYearId: input.academicYearId, code: input.code },
      include: { academicYear: { select: { label: true } } },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: `An exam with code "${duplicate.code}" already exists for ${duplicate.academicYear.label}. Choose a different code, or open the existing exam instead.` },
        { status: 409 },
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.exam.create({
        data: {
          schoolId,
          name: input.name,
          code: input.code,
          academicYearId: input.academicYearId,
          examTypeId: input.examTypeId,
          term: input.term,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          resultDate: input.resultDate ? new Date(input.resultDate) : undefined,
          resultType: input.resultType,
          status: input.status,
          classes: { create: input.classes.map((c) => ({ classId: c.classId, sectionId: c.sectionId })) },
        },
        include: examInclude,
      });
      await recordAudit(tx, { schoolId, userId: user.id, action: "exam.create", entityType: "Exam", entityId: row.id, after: row });
      return row;
    });

    return NextResponse.json(serializeExam(created), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
