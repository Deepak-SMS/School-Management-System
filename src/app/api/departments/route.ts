import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import { departmentInputSchema } from "@/lib/validation/department";
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
  const departmentType = params.get("departmentType") ?? undefined;
  const campusId = params.get("campusId") ?? undefined;

  const where: Prisma.DepartmentWhereInput = {
    schoolId,
    ...(status && { status }),
    ...(departmentType && { departmentType }),
    ...(campusId && { campusId }),
    ...(q && { OR: [{ name: { contains: q } }, { code: { contains: q } }] }),
  };

  const [departments, total] = await Promise.all([
    prisma.department.findMany({
      where,
      include: { head: { select: { id: true, fullName: true } }, campus: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.department.count({ where }),
  ]);

  const data = await Promise.all(
    departments.map(async (dept) => {
      const [employees, teachers] = await Promise.all([
        prisma.staff.count({ where: { departmentId: dept.id } }),
        prisma.staff.count({ where: { departmentId: dept.id, category: "teacher" } }),
      ]);
      return { ...dept, counts: { employees, teachers } };
    }),
  );

  return NextResponse.json({ data, total, page, pageSize });
}

export async function POST(request: NextRequest) {
  try {
    const schoolId = await getCurrentSchoolId();
    const body = await request.json();
    const input = cleanEmptyStrings(departmentInputSchema.parse(body));

    const department = await prisma.$transaction(async (tx) => {
      const created = await tx.department.create({
        data: {
          schoolId,
          name: input.name,
          code: input.code,
          departmentType: input.departmentType,
          headStaffId: input.headStaffId,
          description: input.description,
          campusId: input.campusId,
          email: input.email,
          phone: input.phone,
          status: input.status,
        },
      });
      await recordAudit(tx, { schoolId, action: "department.create", entityType: "Department", entityId: created.id, after: created });
      return created;
    });

    return NextResponse.json(department, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
