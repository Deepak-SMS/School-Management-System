import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { lateFeeRuleInputSchema } from "@/lib/validation/late-fee-rule";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

/** Reusable late-payment penalty rules a Fee Structure item can attach. */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("lateFeeRules", "view");
    const params = request.nextUrl.searchParams;
    const q = params.get("q")?.trim();
    const status = params.get("status") ?? undefined;

    const where: Prisma.LateFeeRuleWhereInput = {
      schoolId,
      ...(status && { status }),
      ...(q && { name: { contains: q } }),
    };

    const rows = await prisma.lateFeeRule.findMany({ where, orderBy: { name: "asc" } });

    const data = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        counts: { items: await prisma.feeStructureItem.count({ where: { lateFeeRuleId: row.id } }) },
      })),
    );

    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("lateFeeRules", "create");
    const { schoolId } = user;
    const input = cleanEmptyStrings(lateFeeRuleInputSchema.parse(await request.json()));

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.lateFeeRule.create({ data: { schoolId, ...input } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "lateFeeRule.create",
        entityType: "LateFeeRule",
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
