import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { feeStudentCategoryInputSchema, FEE_STUDENT_CATEGORY_DEFAULTS } from "@/lib/validation/fee-student-category";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

/** Fee-purpose student groupings (General, RTE, Staff Ward, Sibling...) that a Fee Structure can target. */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("feeStudentCategories", "view");
    const params = request.nextUrl.searchParams;
    const q = params.get("q")?.trim();
    const status = params.get("status") ?? undefined;

    const where: Prisma.FeeStudentCategoryWhereInput = {
      schoolId,
      ...(status && { status }),
      ...(q && { OR: [{ name: { contains: q } }, { code: { contains: q } }] }),
    };

    const rows = await prisma.feeStudentCategory.findMany({ where, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });

    const data = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        counts: {
          students: await prisma.student.count({ where: { schoolId, feeCategoryId: row.id } }),
          feeStructures: await prisma.feeStructure.count({ where: { schoolId, studentCategoryId: row.id } }),
        },
      })),
    );

    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("feeStudentCategories", "create");
    const { schoolId } = user;
    const input = cleanEmptyStrings(feeStudentCategoryInputSchema.parse(await request.json()));

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.feeStudentCategory.create({ data: { schoolId, ...FEE_STUDENT_CATEGORY_DEFAULTS, ...input } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "feeStudentCategory.create",
        entityType: "FeeStudentCategory",
        entityId: row.id,
        after: row,
      });
      return row;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
