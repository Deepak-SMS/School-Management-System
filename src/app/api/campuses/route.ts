import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import { campusInputSchema } from "@/lib/validation/campus";
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
  const status = params.get("status") ?? undefined;

  const where: Prisma.CampusWhereInput = {
    schoolId,
    ...(status && { status }),
    ...(q && {
      OR: [{ name: { contains: q } }, { code: { contains: q } }, { city: { contains: q } }],
    }),
  };

  const [campuses, total] = await Promise.all([
    prisma.campus.findMany({
      where,
      include: { head: { select: { id: true, fullName: true } }, _count: { select: { classes: true, sections: true, departments: true } } },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.campus.count({ where }),
  ]);

  const data = await Promise.all(
    campuses.map(async (campus) => {
      const students = await prisma.student.count({ where: { schoolId, class: { campusId: campus.id } } });
      const { _count, ...rest } = campus;
      return { ...rest, counts: { classes: _count.classes, sections: _count.sections, departments: _count.departments, students } };
    }),
  );

  return NextResponse.json({ data, total, page, pageSize });
}

export async function POST(request: NextRequest) {
  try {
    const schoolId = await getCurrentSchoolId();
    const body = await request.json();
    const input = cleanEmptyStrings(campusInputSchema.parse(body));

    const campus = await prisma.$transaction(async (tx) => {
      const created = await tx.campus.create({
        data: {
          schoolId,
          name: input.name,
          code: input.code,
          campusType: input.campusType,
          headStaffId: input.headStaffId,
          address: input.address,
          city: input.city,
          state: input.state,
          country: input.country,
          pinCode: input.pinCode,
          phone: input.phone,
          email: input.email,
          website: input.website,
          studentCapacity: input.studentCapacity,
          staffCapacity: input.staffCapacity,
          status: input.status,
        },
      });
      await recordAudit(tx, { schoolId, action: "campus.create", entityType: "Campus", entityId: created.id, after: created });
      return created;
    });

    return NextResponse.json(campus, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
