import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/db";
import { expenseAttachmentSchema } from "@/lib/validation/expense";
import { canAttach } from "@/lib/finance/expense-workflow";
import { recordAudit } from "@/lib/audit";
import type { ExpenseStatus } from "@/lib/constants/expenses";
import { apiError } from "@/lib/api-error";

/** Bills and invoices filed against an expense. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("expenses", "view");
    const { id } = await params;

    const expense = await prisma.expense.findFirst({ where: { id, schoolId }, select: { id: true } });
    if (!expense) return NextResponse.json({ error: "Expense not found." }, { status: 404 });

    const data = await prisma.expenseAttachment.findMany({
      where: { expenseId: id },
      include: { uploadedFile: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    return apiError(error);
  }
}

/**
 * Attaches a bill.
 *
 * Only while the expense is still editable — a bill swapped after approval
 * would mean the approver signed off on a document nobody can now see.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("expenses", "edit");
    const { schoolId } = user;
    const { id } = await params;

    const expense = await prisma.expense.findFirst({ where: { id, schoolId } });
    if (!expense) return NextResponse.json({ error: "Expense not found." }, { status: 404 });

    if (!canAttach(expense.status as ExpenseStatus)) {
      return NextResponse.json(
        { error: `This expense is ${expense.status}; its bills can no longer be changed.` },
        { status: 409 },
      );
    }

    const input = expenseAttachmentSchema.parse(await request.json());

    // The file must belong to this school — an id alone is not authorization.
    const file = await prisma.uploadedFile.findFirst({ where: { id: input.uploadedFileId, schoolId } });
    if (!file) return NextResponse.json({ error: "Uploaded file not found." }, { status: 404 });

    const attachment = await prisma.$transaction(async (tx) => {
      const row = await tx.expenseAttachment.create({
        data: {
          expenseId: id,
          uploadedFileId: input.uploadedFileId,
          kind: input.kind ?? "bill",
          label: input.label,
          uploadedById: user.id,
        },
        include: { uploadedFile: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true } } },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "finance.expense.attachment.add",
        entityType: "Expense",
        entityId: id,
        after: { attachmentId: row.id, kind: row.kind, file: row.uploadedFile.originalName },
      });

      return row;
    });

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
