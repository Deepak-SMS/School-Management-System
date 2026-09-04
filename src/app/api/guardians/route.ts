import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

/** List view behind Parent/Guardian Accounts — search + each guardian's linked children and login status. */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("guardians", "view");
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 20)));
    const q = params.get("q")?.trim();
    const classId = params.get("classId") ?? undefined;
    const sectionId = params.get("sectionId") ?? undefined;

    const where: Prisma.GuardianWhereInput = {
      schoolId,
      ...((classId || sectionId) && {
        students: { some: { student: { ...(classId && { classId }), ...(sectionId && { sectionId }) } } },
      }),
      ...(q && {
        OR: [
          { fullName: { contains: q } },
          { mobile: { contains: q } },
          { email: { contains: q } },
        ],
      }),
    };

    const [rows, total] = await Promise.all([
      prisma.guardian.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          mobile: true,
          email: true,
          user: { select: { id: true, email: true, isActive: true, mustChangePassword: true } },
          students: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              relationship: true,
              isPrimary: true,
              canAccessPortal: true,
              student: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  class: { select: { name: true } },
                  section: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: { fullName: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.guardian.count({ where }),
    ]);

    return NextResponse.json({ data: rows, total, page, pageSize });
  } catch (error) {
    return apiError(error);
  }
}
