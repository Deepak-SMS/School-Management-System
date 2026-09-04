import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { RequestUser } from "@/lib/current-user";
import { recordAudit } from "@/lib/audit";
import { financialYearOf } from "@/lib/fees/receipt-number";
import { EXPENSE_SERIES, type ExpenseStatus } from "@/lib/constants/expenses";
import {
  canTransition,
  canApprove,
  InvalidExpenseTransitionError,
  SelfApprovalError,
} from "@/lib/finance/expense-workflow";

/**
 * Moving an expense through the workflow.
 *
 * Every transition goes through `transition()` below, which does four things in
 * one transaction: check the move is legal, apply it, stamp who did it, and
 * write both the expense's own event trail and the cross-module audit log. A
 * route that skipped any of those would leave an expense whose history doesn't
 * explain how it got where it is.
 */

export class ExpenseError extends Error {
  status: number;

  constructor(message: string, status = 422) {
    super(message);
    this.name = "ExpenseError";
    this.status = status;
  }
}

/**
 * Expense numbers run per financial year, like receipts: EXP/2026-27/000123.
 * The counter is bumped atomically inside the caller's transaction, so two
 * people filing a bill at once can't collide.
 */
async function nextExpenseNumber(tx: Prisma.TransactionClient, schoolId: string, date: Date): Promise<string> {
  const { startYear, label } = financialYearOf(date);

  await tx.receiptCounter.upsert({
    where: { schoolId_series_year: { schoolId, series: EXPENSE_SERIES, year: startYear } },
    create: { schoolId, series: EXPENSE_SERIES, year: startYear, next: 1 },
    update: {},
  });

  const counter = await tx.receiptCounter.update({
    where: { schoolId_series_year: { schoolId, series: EXPENSE_SERIES, year: startYear } },
    data: { next: { increment: 1 } },
    select: { next: true },
  });

  return `${EXPENSE_SERIES}/${label}/${String(counter.next - 1).padStart(6, "0")}`;
}

export interface CreateExpenseData {
  categoryId: string;
  title: string;
  description?: string;
  amount: number;
  taxAmount?: number;
  expenseDate: string;
  payeeName: string;
  payeeContact?: string;
  payeeGstin?: string;
  paymentMethod?: string;
  referenceNo?: string;
  bankName?: string;
  campusId?: string;
  departmentId?: string;
  note?: string;
}

export async function createExpense(user: RequestUser, data: CreateExpenseData) {
  const { schoolId } = user;

  const category = await prisma.expenseCategory.findFirst({
    where: { id: data.categoryId, schoolId },
    select: { id: true, status: true, name: true },
  });
  if (!category) throw new ExpenseError("That expense category doesn't exist.", 404);
  if (category.status !== "active") {
    throw new ExpenseError(`"${category.name}" is inactive. Choose a current category.`, 422);
  }

  const expenseDate = new Date(data.expenseDate);

  return prisma.$transaction(async (tx) => {
    const expenseNumber = await nextExpenseNumber(tx, schoolId, expenseDate);

    const expense = await tx.expense.create({
      data: {
        schoolId,
        expenseNumber,
        categoryId: data.categoryId,
        title: data.title,
        description: data.description,
        amount: data.amount,
        taxAmount: data.taxAmount ?? 0,
        expenseDate,
        payeeName: data.payeeName,
        payeeContact: data.payeeContact,
        payeeGstin: data.payeeGstin,
        paymentMethod: data.paymentMethod,
        referenceNo: data.referenceNo,
        bankName: data.bankName,
        campusId: data.campusId,
        departmentId: data.departmentId,
        note: data.note,
        // Always starts as the author's own draft, whatever their role — the
        // workflow is entered deliberately, never skipped at creation.
        status: "draft",
        createdById: user.id,
      },
    });

    await tx.expenseEvent.create({
      data: { expenseId: expense.id, toStatus: "draft", actorId: user.id, actorName: user.name, note: "Created" },
    });

    await recordAudit(tx, {
      schoolId,
      userId: user.id,
      action: "finance.expense.create",
      entityType: "Expense",
      entityId: expense.id,
      after: { expenseNumber, amount: expense.amount, category: category.name, payee: expense.payeeName },
    });

    return expense;
  });
}

export interface TransitionOptions {
  /** Free-text note stored on the event; the reason for a rejection or cancellation. */
  note?: string;
  /** Extra columns to write alongside the status change (payment details, etc.). */
  data?: Prisma.ExpenseUpdateInput;
}

/**
 * The single path by which an expense changes status.
 *
 * Re-reads the expense inside the transaction before checking the transition,
 * so two approvers clicking at once can't both succeed — the second finds the
 * status already moved and gets a clear conflict rather than double-approving.
 */
export async function transition(
  user: RequestUser,
  expenseId: string,
  to: ExpenseStatus,
  options: TransitionOptions = {},
) {
  const { schoolId } = user;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.expense.findFirst({
      where: { id: expenseId, schoolId },
      select: { id: true, status: true, submittedById: true, createdById: true, expenseNumber: true, amount: true },
    });
    if (!existing) throw new ExpenseError("Expense not found.", 404);

    const from = existing.status as ExpenseStatus;
    if (from === to) throw new ExpenseError(`This expense is already ${to}.`, 409);
    if (!canTransition(from, to)) throw new InvalidExpenseTransitionError(from, to);

    // Whoever asked for the money must not be the one signing it off.
    if (to === "approved" && !canApprove(existing.submittedById ?? existing.createdById, user.id)) {
      throw new SelfApprovalError();
    }

    const now = new Date();
    const stamps: Prisma.ExpenseUpdateInput = {};
    if (to === "submitted") Object.assign(stamps, { submittedById: user.id, submittedAt: now });
    if (to === "approved") Object.assign(stamps, { approvedById: user.id, approvedAt: now, rejectionReason: null });
    if (to === "rejected") {
      Object.assign(stamps, { rejectedById: user.id, rejectedAt: now, rejectionReason: options.note ?? null });
    }
    if (to === "paid") Object.assign(stamps, { paidById: user.id, paidOn: options.data?.paidOn ?? now });
    if (to === "cancelled") Object.assign(stamps, { cancelledAt: now, cancelReason: options.note ?? null });

    const expense = await tx.expense.update({
      where: { id: expenseId },
      data: { ...options.data, ...stamps, status: to },
    });

    await tx.expenseEvent.create({
      data: {
        expenseId,
        fromStatus: from,
        toStatus: to,
        actorId: user.id,
        actorName: user.name,
        note: options.note,
      },
    });

    await recordAudit(tx, {
      schoolId,
      userId: user.id,
      action: `finance.expense.${to}`,
      entityType: "Expense",
      entityId: expenseId,
      before: { status: from },
      after: { status: to, expenseNumber: existing.expenseNumber, amount: existing.amount, note: options.note },
    });

    return expense;
  });
}

/** Totals for the register header, by status. Rejected and cancelled are excluded from spend. */
export async function expenseTotals(schoolId: string, where: Prisma.ExpenseWhereInput) {
  const grouped = await prisma.expense.groupBy({
    by: ["status"],
    where: { ...where, schoolId },
    _sum: { amount: true },
    _count: { _all: true },
  });

  const byStatus = Object.fromEntries(
    grouped.map((g) => [g.status, { amount: g._sum.amount ?? 0, count: g._count._all }]),
  ) as Record<string, { amount: number; count: number }>;

  return {
    byStatus,
    awaitingApproval: byStatus.submitted?.amount ?? 0,
    approvedUnpaid: byStatus.approved?.amount ?? 0,
    paid: byStatus.paid?.amount ?? 0,
  };
}
