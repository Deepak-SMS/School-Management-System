import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

/**
 * List view behind Student Accounts (credential management) — same filter
 * shape as GET /api/students, plus each row's login status. Kept as its own
 * route rather than adding `?include=account` to the main list, since that
 * route's response is already relied on elsewhere with its current shape.
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("students", "view");
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 20)));
    const q = params.get("q")?.trim();
    const classId = params.get("classId") ?? undefined;
    const sectionId = params.get("sectionId") ?? undefined;

    const where: Prisma.StudentWhereInput = {
      schoolId,
      status: "active",
      ...(classId && { classId }),
      ...(sectionId && { sectionId }),
      ...(q && {
        OR: [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
          { admissionNumber: { contains: q } },
        ],
      }),
    };

    const [rows, total] = await Promise.all([
      prisma.student.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          admissionNumber: true,
          photoUrl: true,
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
          user: { select: { id: true, email: true, isActive: true, mustChangePassword: true } },
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.student.count({ where }),
    ]);

    return NextResponse.json({ data: rows, total, page, pageSize });
  } catch (error) {
    return apiError(error);
  }
}
