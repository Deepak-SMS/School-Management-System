import type { ExpenseStatus } from "@/lib/constants/expenses";
import type { PermissionAction } from "@/types/permissions";

/**
 * The expense approval workflow as an explicit state machine.
 *
 * Every route asks this module rather than deciding for itself, so the rules
 * can't drift between the submit route, the approve route and the pay route.
 * Two things it exists to prevent: an expense reaching `paid` without ever
 * having been approved, and an approved expense being quietly edited afterwards.
 */

const TRANSITIONS: Record<ExpenseStatus, ExpenseStatus[]> = {
  // Still the author's; they can send it for approval or abandon it.
  draft: ["submitted", "cancelled"],
  // With the approver now. Sending it back is a rejection, with a reason.
  submitted: ["approved", "rejected", "cancelled"],
  // Approved but not yet paid. Can still be cancelled if the spend is called off.
  approved: ["paid", "cancelled"],
  // Back with the author to correct and resubmit.
  rejected: ["draft", "cancelled"],
  // Terminal: money has left the school.
  paid: [],
  cancelled: [],
};

export function allowedTransitions(from: ExpenseStatus): ExpenseStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function canTransition(from: ExpenseStatus, to: ExpenseStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export class InvalidExpenseTransitionError extends Error {
  constructor(from: ExpenseStatus, to: ExpenseStatus) {
    super(
      `An expense at "${from}" can't move to "${to}". Allowed from here: ${
        allowedTransitions(from).join(", ") || "none"
      }.`,
    );
    this.name = "InvalidExpenseTransitionError";
  }
}

/**
 * The permission each move needs.
 *
 * This is what separates submitting from approving: raising and submitting an
 * expense needs `expenses:create`, which ordinary staff hold, while approving
 * needs `expenses:approve`, which they do not. The route enforces it; the UI
 * only mirrors it.
 */
export const ACTION_PERMISSION: Record<ExpenseStatus, PermissionAction> = {
  draft: "edit",
  submitted: "create",
  approved: "approve",
  rejected: "approve",
  paid: "edit",
  cancelled: "edit",
};

/**
 * An expense is only editable while it is the author's to change. Once it is
 * with an approver or beyond, the amount and payee are fixed — otherwise
 * "approved" would mean nothing.
 */
export function isEditable(status: ExpenseStatus): boolean {
  return status === "draft" || status === "rejected";
}

/** Attachments follow the same rule: a bill can't be swapped after approval. */
export function canAttach(status: ExpenseStatus): boolean {
  return isEditable(status);
}

export class SelfApprovalError extends Error {
  constructor() {
    super("You can't approve an expense you submitted yourself. Someone else with approval rights must review it.");
    this.name = "SelfApprovalError";
  }
}

/**
 * Whether `approverId` may approve an expense submitted by `submitterId`.
 *
 * Self-approval is the single most common way an expenses process is abused, so
 * it is blocked outright rather than left to policy. A school admin approving
 * their own claim is exactly the case this catches.
 */
export function canApprove(submitterId: string | null, approverId: string): boolean {
  return submitterId !== approverId;
}
