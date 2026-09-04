import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/db";
import { expenseCategoryInputSchema } from "@/lib/validation/expense";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("expenseCategories", "edit");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.expenseCategory.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Category not found." }, { status: 404 });

    // `.partial()` on a schema whose fields carry defaults would silently reset
    // anything the caller didn't send, so every field here is plainly optional.
    const input = cleanEmptyStrings(expenseCategoryInputSchema.partial().parse(await request.json()));

    const category = await prisma.$transaction(async (tx) => {
      const row = await tx.expenseCategory.update({
        where: { id },
        data: { ...input, code: input.code ? input.code.toUpperCase() : undefined },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "finance.expenseCategory.update",
        entityType: "ExpenseCategory",
        entityId: id,
        before: { name: existing.name, code: existing.code, status: existing.status },
        after: { name: row.name, code: row.code, status: row.status },
      });

      return row;
    });

    return NextResponse.json(category);
  } catch (error) {
    return apiError(error);
  }
}

/**
 * Removes a category.
 *
 * Refused once anything has been booked against it — deleting would orphan real
 * expenditure. Deactivating instead keeps the history readable and takes the
 * category out of the dropdown, which is what the request usually means.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("expenseCategories", "delete");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.expenseCategory.findFirst({
      where: { id, schoolId },
      include: { _count: { select: { expenses: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Category not found." }, { status: 404 });

    if (existing._count.expenses > 0) {
      return NextResponse.json(
        {
          error: `"${existing.name}" has ${existing._count.expenses} expense${
            existing._count.expenses === 1 ? "" : "s"
          } booked against it. Set it to inactive instead — that hides it from new entries and keeps the history.`,
        },
        { status: 409 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.expenseCategory.delete({ where: { id } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "finance.expenseCategory.delete",
        entityType: "ExpenseCategory",
        entityId: id,
        before: { name: existing.name, code: existing.code },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
