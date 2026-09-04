import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/db";
import { canAttach } from "@/lib/finance/expense-workflow";
import { recordAudit } from "@/lib/audit";
import type { ExpenseStatus } from "@/lib/constants/expenses";
import { apiError } from "@/lib/api-error";

/**
 * Removes a bill from an expense.
 *
 * Same rule as adding one: only while the expense is still the author's. The
 * `UploadedFile` row is left alone — it may be referenced elsewhere, and
 * orphaned files are swept centrally rather than deleted from here.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  try {
    const user = await requirePermission("expenses", "edit");
    const { schoolId } = user;
    const { id, attachmentId } = await params;

    const expense = await prisma.expense.findFirst({ where: { id, schoolId }, select: { id: true, status: true } });
    if (!expense) return NextResponse.json({ error: "Expense not found." }, { status: 404 });

    if (!canAttach(expense.status as ExpenseStatus)) {
      return NextResponse.json(
        { error: `This expense is ${expense.status}; its bills can no longer be changed.` },
        { status: 409 },
      );
    }

    const attachment = await prisma.expenseAttachment.findFirst({
      where: { id: attachmentId, expenseId: id },
      include: { uploadedFile: { select: { originalName: true } } },
    });
    if (!attachment) return NextResponse.json({ error: "Attachment not found." }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.expenseAttachment.delete({ where: { id: attachmentId } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "finance.expense.attachment.remove",
        entityType: "Expense",
        entityId: id,
        before: { attachmentId, file: attachment.uploadedFile.originalName },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
