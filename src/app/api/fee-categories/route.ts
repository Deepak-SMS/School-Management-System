import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { feeCategoryInputSchema, FEE_CATEGORY_DEFAULTS } from "@/lib/validation/fee-category";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

/** Fee heads master (Tuition, Admission, Transport...) — the building blocks every Fee Structure item picks from. */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("feeCategories", "view");
    const params = request.nextUrl.searchParams;
    const q = params.get("q")?.trim();
    const status = params.get("status") ?? undefined;

    const where: Prisma.FeeCategoryWhereInput = {
      schoolId,
      ...(status && { status }),
      ...(q && { OR: [{ name: { contains: q } }, { code: { contains: q } }] }),
    };

    const rows = await prisma.feeCategory.findMany({ where, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });

    const data = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        counts: { items: await prisma.feeStructureItem.count({ where: { feeCategoryId: row.id } }) },
      })),
    );

    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("feeCategories", "create");
    const { schoolId } = user;
    const input = cleanEmptyStrings(feeCategoryInputSchema.parse(await request.json()));

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.feeCategory.create({ data: { schoolId, ...FEE_CATEGORY_DEFAULTS, ...input } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "feeCategory.create",
        entityType: "FeeCategory",
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
