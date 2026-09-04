interface ChargeForLedger {
  amount: number;
  dueDate: Date | null;
  status: string;
  adjustments: { type: string; amount: number }[];
  /** Non-cancelled payments allocated against this charge — see Payment/PaymentAllocation in schema.prisma. */
  allocations: { amount: number; payment: { status: string } }[];
}

/** Amount actually payable on this charge: original amount, reduced by waivers/discounts/transfers-out, moved by corrections — before any payment is applied. A cancelled charge is always 0. */
export function chargeAdjustedAmount(charge: ChargeForLedger): number {
  if (charge.status === "cancelled") return 0;
  return charge.adjustments.reduce((net, adjustment) => {
    if (adjustment.type === "correction") return net + adjustment.amount;
    return net - adjustment.amount; // waiver | discount | transfer_out
  }, charge.amount);
}

/** Sum of waiver/discount adjustments only — distinct from a correction or a transfer. */
export function chargeWaivedAmount(charge: ChargeForLedger): number {
  return charge.adjustments
    .filter((a) => a.type === "waiver" || a.type === "discount")
    .reduce((sum, a) => sum + a.amount, 0);
}

/** Sum of payments actually received against this charge — excludes cancelled payments, whose receipts are voided. */
export function chargePaidAmount(charge: ChargeForLedger): number {
  return charge.allocations
    .filter((a) => a.payment.status !== "cancelled")
    .reduce((sum, a) => sum + a.amount, 0);
}

/** What's left to collect on this charge: adjusted amount minus what's been paid. Can be negative (a credit) if overpaid — callers doing pending/overdue math should floor it at 0 themselves. */
export function chargeOutstandingAmount(charge: ChargeForLedger): number {
  return chargeAdjustedAmount(charge) - chargePaidAmount(charge);
}

export interface StudentFeeSummary {
  /** What the student actually owes after waivers/discounts/corrections, before payments. */
  totalCharged: number;
  totalWaived: number;
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
  totalUpcoming: number;
}

/** Rolls a student's charges into the headline numbers the Student Fees screens show. */
export function summarizeStudentFees(charges: ChargeForLedger[], asOf: Date = new Date()): StudentFeeSummary {
  const summary: StudentFeeSummary = {
    totalCharged: 0,
    totalWaived: 0,
    totalPaid: 0,
    totalPending: 0,
    totalOverdue: 0,
    totalUpcoming: 0,
  };

  for (const charge of charges) {
    if (charge.status === "cancelled") continue;
    const adjusted = chargeAdjustedAmount(charge);
    const paid = chargePaidAmount(charge);
    const outstanding = Math.max(0, adjusted - paid);

    summary.totalCharged += adjusted;
    summary.totalWaived += chargeWaivedAmount(charge);
    summary.totalPaid += paid;
    summary.totalPending += outstanding;

    if (outstanding > 0 && charge.dueDate) {
      if (charge.dueDate < asOf) summary.totalOverdue += outstanding;
      else summary.totalUpcoming += outstanding;
    }
  }

  return summary;
}
