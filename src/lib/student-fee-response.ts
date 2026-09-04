import type { Prisma } from "@/generated/prisma/client";
import {
  chargeAdjustedAmount,
  chargeWaivedAmount,
  chargePaidAmount,
  chargeOutstandingAmount,
  summarizeStudentFees,
} from "@/lib/student-fee-ledger";

/** Shared shape for every route that returns a student's fee charges — the account view, and the create/adjust/transfer actions that return the updated charge. */
export const studentFeeChargeInclude = {
  feeStructure: { select: { id: true, name: true } },
  feeCategory: { select: { id: true, name: true, code: true } },
  adjustments: {
    orderBy: { appliedAt: "desc" as const },
    include: {
      relatedStudent: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
    },
  },
  allocations: {
    include: { payment: { select: { status: true } } },
  },
} satisfies Prisma.StudentFeeChargeInclude;

type ChargeWithRelations = Prisma.StudentFeeChargeGetPayload<{ include: typeof studentFeeChargeInclude }>;

/** Adds the computed amount breakdown every screen needs — see src/lib/student-fee-ledger.ts. */
export function shapeStudentFeeCharge(charge: ChargeWithRelations) {
  return {
    ...charge,
    adjustedAmount: chargeAdjustedAmount(charge),
    waivedAmount: chargeWaivedAmount(charge),
    paidAmount: chargePaidAmount(charge),
    outstandingAmount: chargeOutstandingAmount(charge),
  };
}

/**
 * Builds the full account view from a student's charges: every adjustment
 * targets a charge (see StudentFeeAdjustment in schema.prisma), so the flat
 * "recent activity" list is just every charge's adjustments flattened —
 * there's no separate query needed to catch account-level ones.
 */
export function buildStudentFeeAccount(charges: ChargeWithRelations[]) {
  return {
    charges: charges.map(shapeStudentFeeCharge),
    summary: summarizeStudentFees(charges),
    adjustments: charges
      .flatMap((charge) => charge.adjustments)
      .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()),
  };
}
