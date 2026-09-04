import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/db";
import { expenseUpdateSchema } from "@/lib/validation/expense";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { isEditable } from "@/lib/finance/expense-workflow";
import { recordAudit } from "@/lib/audit";
import type { ExpenseStatus } from "@/lib/constants/expenses";
import { apiError } from "@/lib/api-error";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("expenses", "view");
    const { id } = await params;

    const expense = await prisma.expense.findFirst({
      where: { id, schoolId },
      include: {
        category: { select: { id: true, name: true, code: true } },
        attachments: {
          include: { uploadedFile: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true } } },
          orderBy: { createdAt: "asc" },
        },
        events: { orderBy: { occurredAt: "asc" } },
      },
    });
    if (!expense) return NextResponse.json({ error: "Expense not found." }, { status: 404 });

    return NextResponse.json(expense);
  } catch (error) {
    return apiError(error);
  }
}

/**
 * Edits an expense.
 *
 * Only while it is still the author's — a draft, or one sent back to them. Once
 * an expense is with an approver or beyond, the amount and payee are fixed;
 * otherwise "approved" would tell you nothing about what was approved.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("expenses", "edit");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.expense.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Expense not found." }, { status: 404 });

    if (!isEditable(existing.status as ExpenseStatus)) {
      return NextResponse.json(
        {
          error: `This expense is ${existing.status} and can no longer be edited. Cancel it and raise a new one if it is wrong.`,
        },
        { status: 409 },
      );
    }

    const input = cleanEmptyStrings(expenseUpdateSchema.parse(await request.json()));

    if (input.categoryId) {
      const category = await prisma.expenseCategory.findFirst({
        where: { id: input.categoryId, schoolId },
        select: { id: true },
      });
      if (!category) return NextResponse.json({ error: "That expense category doesn't exist." }, { status: 422 });
    }

    // Guarded here as well as in the schema: a PATCH may change only one of the two.
    const amount = input.amount ?? existing.amount;
    const tax = input.taxAmount ?? existing.taxAmount;
    if (tax > amount) {
      return NextResponse.json(
        {
          error: "Tax can't be more than the total amount.",
          fieldErrors: { taxAmount: ["Tax can't exceed the amount"] },
        },
        { status: 422 },
      );
    }

    const expense = await prisma.$transaction(async (tx) => {
      const updated = await tx.expense.update({
        where: { id },
        data: { ...input, expenseDate: input.expenseDate ? new Date(input.expenseDate) : undefined },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "finance.expense.update",
        entityType: "Expense",
        entityId: id,
        before: { amount: existing.amount, payeeName: existing.payeeName, categoryId: existing.categoryId },
        after: { amount: updated.amount, payeeName: updated.payeeName, categoryId: updated.categoryId },
      });

      return updated;
    });

    return NextResponse.json(expense);
  } catch (error) {
    return apiError(error);
  }
}

/**
 * Removes an expense outright.
 *
 * Only a draft may be deleted — anything that has been submitted is part of the
 * approval record and is cancelled instead, which keeps the row and its trail.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("expenses", "delete");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.expense.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Expense not found." }, { status: 404 });

    if (existing.status !== "draft") {
      return NextResponse.json(
        {
          error: `Only a draft can be deleted. This one is ${existing.status} — cancel it instead, so the record survives.`,
        },
        { status: 409 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.expense.delete({ where: { id } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "finance.expense.delete",
        entityType: "Expense",
        entityId: id,
        before: { expenseNumber: existing.expenseNumber, amount: existing.amount, payeeName: existing.payeeName },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
