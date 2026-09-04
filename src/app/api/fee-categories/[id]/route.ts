import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { feeCategoryInputSchema } from "@/lib/validation/fee-category";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("feeCategories", "edit");
    const { schoolId } = user;
    const { id } = await params;
    const input = cleanEmptyStrings(feeCategoryInputSchema.partial().parse(await request.json()));

    const existing = await prisma.feeCategory.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Fee category not found." }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.feeCategory.update({ where: { id }, data: input });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "feeCategory.update",
        entityType: "FeeCategory",
        entityId: id,
        before: existing,
        after: row,
      });
      return row;
    });

    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}

/** Deactivates rather than deletes when a fee structure item still references it — removing it would strip the fee head off a published structure's history. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("feeCategories", "delete");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.feeCategory.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Fee category not found." }, { status: 404 });

    const inUse = await prisma.feeStructureItem.count({ where: { feeCategoryId: id } });

    const result = await prisma.$transaction(async (tx) => {
      if (inUse > 0) {
        const row = await tx.feeCategory.update({ where: { id }, data: { status: "inactive" } });
        await recordAudit(tx, {
          schoolId,
          userId: user.id,
          action: "feeCategory.deactivate",
          entityType: "FeeCategory",
          entityId: id,
          before: existing,
          after: row,
        });
        return { deactivated: true, items: inUse };
      }

      await tx.feeCategory.delete({ where: { id } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "feeCategory.delete",
        entityType: "FeeCategory",
        entityId: id,
        before: existing,
      });
      return { deactivated: false, items: 0 };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return apiError(error);
  }
}
