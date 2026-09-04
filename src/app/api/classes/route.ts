import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import { classInputSchema } from "@/lib/validation/class";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  const schoolId = await getCurrentSchoolId();
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 20)));
  const q = params.get("q")?.trim();
  const campusId = params.get("campusId") ?? undefined;
  const academicYearId = params.get("academicYearId") ?? undefined;
  const status = params.get("status") ?? undefined;

  const where: Prisma.ClassWhereInput = {
    schoolId,
    ...(campusId && { campusId }),
    ...(academicYearId && { academicYearId }),
    ...(status && { status }),
    ...(q && { OR: [{ name: { contains: q } }, { code: { contains: q } }] }),
  };

  const [classes, total] = await Promise.all([
    prisma.class.findMany({
      where,
      include: {
        academicYear: { select: { id: true, label: true } },
        campus: { select: { id: true, name: true } },
        classTeacher: { select: { id: true, fullName: true } },
        _count: { select: { sections: true, students: true } },
      },
      orderBy: [{ academicYear: { startDate: "desc" } }, { sortOrder: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.class.count({ where }),
  ]);

  const data = classes.map(({ _count, ...rest }) => ({ ...rest, counts: { sections: _count.sections, students: _count.students } }));
  return NextResponse.json({ data, total, page, pageSize });
}

export async function POST(request: NextRequest) {
  try {
    const schoolId = await getCurrentSchoolId();
    const body = await request.json();
    const input = cleanEmptyStrings(classInputSchema.parse(body));

    const duplicate = await prisma.class.findFirst({
      where: { schoolId, academicYearId: input.academicYearId, OR: [{ name: input.name }, { code: input.code }] },
      include: { academicYear: { select: { label: true } } },
    });
    if (duplicate) {
      return NextResponse.json(
        {
          error: `A class named "${duplicate.name}" (${duplicate.code}) already exists for ${duplicate.academicYear.label}. Choose a different name/code, or open the existing class instead.`,
        },
        { status: 409 },
      );
    }

    const cls = await prisma.$transaction(async (tx) => {
      const created = await tx.class.create({
        data: {
          schoolId,
          name: input.name,
          code: input.code,
          academicYearId: input.academicYearId,
          campusId: input.campusId,
          sortOrder: input.sortOrder,
          capacity: input.capacity,
          classTeacherId: input.classTeacherId,
          gradingSystem: input.gradingSystem,
          status: input.status,
        },
      });
      await recordAudit(tx, { schoolId, action: "class.create", entityType: "Class", entityId: created.id, after: created });
      return created;
    });

    return NextResponse.json(cls, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
