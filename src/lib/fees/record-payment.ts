import { prisma } from "@/lib/db";
import type { RequestUser } from "@/lib/current-user";
import type { PaymentInput } from "@/lib/validation/payment";
import { recordAudit } from "@/lib/audit";
import { getStudentBalance, planAllocations, validateAllocations, money } from "@/lib/fees/balance";
import { nextReceiptNumber, paymentNumberFrom } from "@/lib/fees/receipt-number";

/**
 * Recording money received, and issuing the receipt for it.
 *
 * These are one operation, not two. A payment that lands without its receipt
 * would leave a family with money taken and nothing to show for it, so both
 * writes — and the audit entry, and the counter bump — happen in a single
 * transaction. If the receipt cannot be issued, the payment does not exist.
 */

export class PaymentError extends Error {
  status: number;
  fieldErrors?: Record<string, string[]>;

  constructor(message: string, status = 422, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "PaymentError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/** One line of the receipt's fee breakdown, frozen at issue time. */
export interface ReceiptComponent {
  label: string;
  category: string;
  /** Face value of the charge. */
  charged: number;
  /** What this payment put against it. */
  paidNow: number;
  /** What has been paid against it in total, including this payment. */
  paidToDate: number;
  /** Still owing on this component after this payment. */
  outstanding: number;
}

export async function recordPayment(user: RequestUser, input: PaymentInput) {
  const { schoolId } = user;

  const student = await prisma.student.findFirst({
    where: { id: input.studentId, schoolId },
    include: {
      class: { select: { name: true } },
      section: { select: { name: true } },
      academicYear: { select: { label: true } },
    },
  });
  if (!student) throw new PaymentError("Student not found.", 404);

  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) throw new PaymentError("School not found.", 404);

  const balance = await getStudentBalance(prisma, schoolId, input.studentId);
  const amount = money(input.amount);

  // Work out which charges this money settles before opening the transaction,
  // so a rejected split costs nothing.
  let plan;
  let unallocated: number;

  if (input.allocations && input.allocations.length > 0) {
    const checked = validateAllocations(balance, input.allocations, amount);
    if (checked.errors.length > 0) {
      throw new PaymentError("That split doesn't work.", 422, { allocations: checked.errors });
    }
    plan = checked.plan;
    unallocated = money(amount - checked.plan.reduce((n, p) => n + p.amount, 0));
  } else {
    const auto = planAllocations(balance, amount);
    plan = auto.plan;
    unallocated = auto.unallocated;
  }

  if (plan.length === 0 && balance.totalOutstanding > 0) {
    throw new PaymentError("None of this payment could be applied to an outstanding fee.", 422);
  }
  if (balance.totalOutstanding <= 0) {
    throw new PaymentError(
      "This student has no outstanding fees. Raise a charge before recording a payment against it.",
      422,
    );
  }

  const paidOn = new Date(input.paidOn);
  const issuedOn = new Date();

  return prisma.$transaction(async (tx) => {
    const { receiptNumber, series } = await nextReceiptNumber(tx, schoolId, issuedOn);

    const payment = await tx.payment.create({
      data: {
        schoolId,
        studentId: student.id,
        paymentNumber: paymentNumberFrom(receiptNumber),
        paidOn,
        amount,
        method: input.method,
        referenceNo: input.referenceNo,
        bankName: input.bankName,
        invoiceRef: input.invoiceRef,
        note: input.note,
        status: "recorded",
        receivedById: user.id,
        allocations: { create: plan.map((p) => ({ chargeId: p.chargeId, amount: p.amount })) },
      },
    });

    // Recomputed inside the transaction so the printed balance accounts for
    // this payment and for anything else that landed while the form was open.
    const after = await getStudentBalance(tx, schoolId, student.id);
    const byCharge = new Map(after.charges.map((c) => [c.chargeId, c]));

    const components: ReceiptComponent[] = plan.map((p) => {
      const charge = byCharge.get(p.chargeId);
      return {
        label: charge?.label ?? "Fee",
        category: charge?.categoryName ?? "",
        charged: charge?.charged ?? 0,
        paidNow: p.amount,
        paidToDate: charge?.paid ?? p.amount,
        outstanding: charge?.outstanding ?? 0,
      };
    });

    const receipt = await tx.receipt.create({
      data: {
        schoolId,
        paymentId: payment.id,
        studentId: student.id,
        receiptNumber,
        series,
        issuedOn,
        issuedById: user.id,

        // Snapshot — see the Receipt model's note on why these are copied.
        schoolName: school.name,
        schoolAddress: [school.address, school.city, school.state, school.pinCode].filter(Boolean).join(", ") || null,
        schoolPhone: school.phone,
        schoolEmail: school.email,
        schoolLogoUrl: school.logoUrl,

        studentName: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" "),
        admissionNumber: student.admissionNumber,
        className: student.class?.name ?? null,
        sectionName: student.section?.name ?? null,
        academicYear: student.academicYear?.label ?? null,

        amountPaid: amount,
        method: input.method,
        referenceNo: input.referenceNo,
        invoiceRef: input.invoiceRef,
        paidOn,
        balanceAfter: after.totalOutstanding,
        componentsJson: JSON.stringify(components),
        status: "issued",
      },
    });

    await recordAudit(tx, {
      schoolId,
      userId: user.id,
      action: "fees.payment.record",
      entityType: "Payment",
      entityId: payment.id,
      after: {
        paymentNumber: payment.paymentNumber,
        receiptNumber: receipt.receiptNumber,
        studentId: student.id,
        amount,
        method: input.method,
        allocations: plan.length,
      },
    });

    return { payment, receipt, unallocated, balanceAfter: after };
  });
}

/**
 * Cancels a payment recorded in error and voids its receipt.
 *
 * Neither row is deleted. The receipt keeps its number — reissuing it would
 * make an existing printed copy indistinguishable from a live one — and the
 * money stops counting as paid because the balance query ignores allocations
 * belonging to a cancelled payment.
 */
export async function cancelPayment(user: RequestUser, paymentId: string, reason: string) {
  const { schoolId } = user;

  const existing = await prisma.payment.findFirst({
    where: { id: paymentId, schoolId },
    include: { receipt: true },
  });
  if (!existing) throw new PaymentError("Payment not found.", 404);
  if (existing.status === "cancelled") throw new PaymentError("This payment is already cancelled.", 409);

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.update({
      where: { id: paymentId },
      data: { status: "cancelled", cancelledAt: now, cancelReason: reason, cancelledById: user.id },
    });

    if (existing.receipt) {
      await tx.receipt.update({
        where: { id: existing.receipt.id },
        data: { status: "void", voidedAt: now, voidReason: reason, voidedById: user.id },
      });
    }

    await recordAudit(tx, {
      schoolId,
      userId: user.id,
      action: "fees.payment.cancel",
      entityType: "Payment",
      entityId: paymentId,
      before: { status: existing.status, amount: existing.amount },
      after: { status: "cancelled", reason, voidedReceipt: existing.receipt?.receiptNumber ?? null },
    });

    return payment;
  });
}

export function parseComponents(componentsJson: string): ReceiptComponent[] {
  try {
    const parsed = JSON.parse(componentsJson);
    return Array.isArray(parsed) ? (parsed as ReceiptComponent[]) : [];
  } catch {
    return [];
  }
}
