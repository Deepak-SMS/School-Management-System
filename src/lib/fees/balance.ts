import type { Prisma, PrismaClient } from "@/generated/prisma/client";

/**
 * What a student owes, and what they've paid.
 *
 * One definition, used by the payment form (to show what's outstanding), by the
 * allocator (to decide which charges a payment settles), and by the receipt (to
 * print the balance). Money that appears in three places has to be computed in
 * one.
 *
 * Rounding: amounts are held as floats because SQLite has no decimal type, so
 * every figure that leaves here is rounded to paise before it is compared or
 * stored. Without that, 0.1 + 0.2 leaves a charge looking one-thirtieth of a
 * paisa short of settled and it never closes.
 */

/** Money is compared and stored at 2 decimal places, never at float precision. */
export function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface ChargeBalance {
  chargeId: string;
  label: string;
  categoryId: string;
  categoryName: string;
  dueDate: Date | null;
  /** Face value of the charge. */
  charged: number;
  /** Waivers, discounts and corrections applied to it. */
  adjusted: number;
  /** Allocated from payments that are still live. */
  paid: number;
  /** charged − adjusted − paid, floored at zero. */
  outstanding: number;
}

export interface StudentBalance {
  charges: ChargeBalance[];
  totalCharged: number;
  totalAdjusted: number;
  totalPaid: number;
  totalOutstanding: number;
}

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Adjustment sign convention: `amount` is always stored positive and always
 * *reduces* what is owed, for every type — a waiver of 500 and a discount of
 * 500 both mean "owe 500 less". A correction that increases a charge is
 * recorded by editing the charge, not by a negative adjustment, so nothing here
 * has to guess at a sign.
 */
export async function getStudentBalance(db: Db, schoolId: string, studentId: string): Promise<StudentBalance> {
  const charges = await db.studentFeeCharge.findMany({
    where: { schoolId, studentId, status: "active" },
    include: {
      feeCategory: { select: { id: true, name: true } },
      adjustments: { select: { amount: true } },
      allocations: {
        // A cancelled payment's allocations must stop counting as paid, or a
        // cancelled receipt would leave the money still settled.
        where: { payment: { status: "recorded" } },
        select: { amount: true },
      },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });

  const rows: ChargeBalance[] = charges.map((c) => {
    const charged = money(c.amount);
    const adjusted = money(c.adjustments.reduce((n, a) => n + a.amount, 0));
    const paid = money(c.allocations.reduce((n, a) => n + a.amount, 0));
    return {
      chargeId: c.id,
      label: c.label,
      categoryId: c.feeCategory.id,
      categoryName: c.feeCategory.name,
      dueDate: c.dueDate,
      charged,
      adjusted,
      paid,
      outstanding: Math.max(0, money(charged - adjusted - paid)),
    };
  });

  return {
    charges: rows,
    totalCharged: money(rows.reduce((n, r) => n + r.charged, 0)),
    totalAdjusted: money(rows.reduce((n, r) => n + r.adjusted, 0)),
    totalPaid: money(rows.reduce((n, r) => n + r.paid, 0)),
    totalOutstanding: money(rows.reduce((n, r) => n + r.outstanding, 0)),
  };
}

export interface AllocationPlan {
  chargeId: string;
  amount: number;
}

/**
 * Spreads a payment across outstanding charges, oldest due date first.
 *
 * A family handing over a round sum doesn't say which term it's for, so the
 * default is the one every accounts office uses: clear the oldest debt first.
 * An explicit split is honoured instead when the cashier gives one.
 */
export function planAllocations(balance: StudentBalance, amount: number): { plan: AllocationPlan[]; unallocated: number } {
  let remaining = money(amount);
  const plan: AllocationPlan[] = [];

  for (const charge of balance.charges) {
    if (remaining <= 0) break;
    if (charge.outstanding <= 0) continue;

    const take = money(Math.min(charge.outstanding, remaining));
    if (take <= 0) continue;

    plan.push({ chargeId: charge.chargeId, amount: take });
    remaining = money(remaining - take);
  }

  // Anything left over is a genuine advance — the family paid more than is
  // currently billed. It is reported rather than silently dropped.
  return { plan, unallocated: money(Math.max(0, remaining)) };
}

/** Checks a cashier-supplied split against what is actually outstanding. */
export function validateAllocations(
  balance: StudentBalance,
  allocations: AllocationPlan[],
  amount: number,
): { errors: string[]; plan: AllocationPlan[] } {
  const errors: string[] = [];
  const byId = new Map(balance.charges.map((c) => [c.chargeId, c]));
  const seen = new Set<string>();
  const plan: AllocationPlan[] = [];

  for (const a of allocations) {
    const charge = byId.get(a.chargeId);
    if (!charge) {
      errors.push(`Charge ${a.chargeId} doesn't belong to this student, or isn't active.`);
      continue;
    }
    if (seen.has(a.chargeId)) {
      errors.push(`${charge.label} appears twice. List each fee component once.`);
      continue;
    }
    seen.add(a.chargeId);

    const value = money(a.amount);
    if (value <= 0) {
      errors.push(`${charge.label}: allocated amount must be more than zero.`);
      continue;
    }
    if (value > charge.outstanding) {
      errors.push(`${charge.label}: only ${charge.outstanding.toFixed(2)} is outstanding, but ${value.toFixed(2)} was allocated.`);
      continue;
    }
    plan.push({ chargeId: a.chargeId, amount: value });
  }

  const allocated = money(plan.reduce((n, p) => n + p.amount, 0));
  if (allocated > money(amount)) {
    errors.push(`The split totals ${allocated.toFixed(2)}, which is more than the ${money(amount).toFixed(2)} being paid.`);
  }

  return { errors, plan };
}
