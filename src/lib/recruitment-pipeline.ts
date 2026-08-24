import type { ApplicationStatus } from "@/lib/constants/hr";

/**
 * The recruitment pipeline as an explicit state machine.
 *
 * Keeping the legal transitions in one place means the rules can't drift between
 * the screening route, the interview route and the offer route — each asks this
 * module rather than re-deciding. It also stops a candidate from, say, jumping
 * straight from `new` to `joined` and skipping the approval steps.
 */

const TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  new: ["screening", "shortlisted", "rejected", "withdrawn", "hold"],
  screening: ["shortlisted", "rejected", "withdrawn", "hold"],
  shortlisted: ["interview", "selected", "rejected", "withdrawn", "hold"],
  interview: ["interview", "selected", "rejected", "withdrawn", "hold"],
  selected: ["offered", "rejected", "withdrawn", "hold"],
  offered: ["joined", "rejected", "withdrawn", "hold"],
  // Terminal: a joined candidate is now an employee, handled by HR not recruitment.
  joined: [],
  rejected: ["screening", "shortlisted"],
  withdrawn: ["screening"],
  hold: ["screening", "shortlisted", "interview", "selected", "rejected", "withdrawn"],
};

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function allowedTransitions(from: ApplicationStatus): ApplicationStatus[] {
  return TRANSITIONS[from] ?? [];
}

export class InvalidTransitionError extends Error {
  constructor(from: ApplicationStatus, to: ApplicationStatus) {
    super(
      `An application at "${from}" can't move to "${to}". Allowed from here: ${
        allowedTransitions(from).join(", ") || "none"
      }.`,
    );
    this.name = "InvalidTransitionError";
  }
}

/** Only an accepted offer on a `selected`/`offered` application may become an employee. */
export function canConvertToEmployee(status: ApplicationStatus): boolean {
  return status === "offered" || status === "selected";
}
