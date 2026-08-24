import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import { sectionInputSchema } from "@/lib/validation/section";
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
  const classId = params.get("classId") ?? undefined;
  const campusId = params.get("campusId") ?? undefined;
  const academicYearId = params.get("academicYearId") ?? undefined;
  const status = params.get("status") ?? undefined;

  const where: Prisma.SectionWhereInput = {
    schoolId,
    ...(classId && { classId }),
    ...(campusId && { campusId }),
    ...(academicYearId && { academicYearId }),
    ...(status && { status }),
    ...(q && { OR: [{ name: { contains: q } }, { code: { contains: q } }] }),
  };

  const [sections, total] = await Promise.all([
    prisma.section.findMany({
      where,
      include: {
        class: { select: { id: true, name: true } },
        academicYear: { select: { id: true, label: true } },
        campus: { select: { id: true, name: true } },
        classTeacher: { select: { id: true, fullName: true } },
        _count: { select: { students: true } },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.section.count({ where }),
  ]);

  const data = sections.map(({ _count, ...rest }) => ({ ...rest, counts: { students: _count.students } }));
  return NextResponse.json({ data, total, page, pageSize });
}

export async function POST(request: NextRequest) {
  try {
    const schoolId = await getCurrentSchoolId();
    const body = await request.json();
    const input = cleanEmptyStrings(sectionInputSchema.parse(body));

    const parentClass = await prisma.class.findFirst({ where: { id: input.classId, schoolId } });
    if (!parentClass) {
      return NextResponse.json({ error: "Validation failed", fieldErrors: { classId: ["Class not found."] } }, { status: 422 });
    }
    if (parentClass.academicYearId !== input.academicYearId || parentClass.campusId !== input.campusId) {
      return NextResponse.json(
        {
          error: "Validation failed",
          fieldErrors: { academicYearId: ["Academic year and campus must match the selected class."] },
        },
        { status: 422 },
      );
    }

    const section = await prisma.$transaction(async (tx) => {
      const created = await tx.section.create({
        data: {
          schoolId,
          classId: input.classId,
          academicYearId: input.academicYearId,
          campusId: input.campusId,
          name: input.name,
          code: input.code,
          room: input.room,
          classTeacherId: input.classTeacherId,
          capacity: input.capacity,
          status: input.status,
        },
      });
      await recordAudit(tx, { schoolId, action: "section.create", entityType: "Section", entityId: created.id, after: created });
      return created;
    });

    return NextResponse.json(section, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
