import { prisma } from "@/lib/db";
import { summarizeStudentFees } from "@/lib/student-fee-ledger";

export interface FeesFilters {
  schoolId: string;
  academicYearId?: string;
  classId?: string;
  sectionId?: string;
  /** Only used for the collection trend below — outstanding/overdue totals and the defaulter list are always "as of now", so omit both to skip the trend. */
  from?: Date;
  /** Exclusive upper bound. */
  to?: Date;
}

const FEE_CHARGE_SELECT = {
  amount: true,
  dueDate: true,
  status: true,
  adjustments: { select: { type: true, amount: true } },
  allocations: { select: { amount: true, payment: { select: { status: true } } } },
} as const;

function studentWhere(f: FeesFilters) {
  return {
    schoolId: f.schoolId,
    feeCharges: { some: {} },
    ...(f.academicYearId && { academicYearId: f.academicYearId }),
    ...(f.classId && { classId: f.classId }),
    ...(f.sectionId && { sectionId: f.sectionId }),
  };
}

export interface FeesOverview {
  totalCharged: number;
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
  collectionPct: number;
  defaulterCount: number;
  monthlyTrend: { month: string; collected: number }[];
  classWise: { classId: string; className: string; charged: number; paid: number; pending: number }[];
}

/** Real fee totals for the window, built on the same `summarizeStudentFees` ledger math the Student Fees screens use — never a re-derived, possibly-inconsistent calculation. */
export async function getFeesOverview(f: FeesFilters): Promise<FeesOverview> {
  const students = await prisma.student.findMany({
    where: studentWhere(f),
    select: { id: true, classId: true, class: { select: { name: true } }, feeCharges: { select: FEE_CHARGE_SELECT } },
  });

  const perStudent = students.map((s) => ({ classId: s.classId, className: s.class.name, summary: summarizeStudentFees(s.feeCharges) }));

  const totals = perStudent.reduce(
    (acc, s) => ({
      charged: acc.charged + s.summary.totalCharged,
      paid: acc.paid + s.summary.totalPaid,
      pending: acc.pending + s.summary.totalPending,
      overdue: acc.overdue + s.summary.totalOverdue,
    }),
    { charged: 0, paid: 0, pending: 0, overdue: 0 },
  );
  const defaulterCount = perStudent.filter((s) => s.summary.totalOverdue > 0).length;

  const classMap = new Map<string, { className: string; charged: number; paid: number; pending: number }>();
  for (const s of perStudent) {
    const bucket = classMap.get(s.classId) ?? { className: s.className, charged: 0, paid: 0, pending: 0 };
    bucket.charged += s.summary.totalCharged;
    bucket.paid += s.summary.totalPaid;
    bucket.pending += s.summary.totalPending;
    classMap.set(s.classId, bucket);
  }
  const classWise = [...classMap.entries()]
    .map(([classId, v]) => ({ classId, ...v }))
    .sort((a, b) => a.className.localeCompare(b.className));

  let monthlyTrend: { month: string; collected: number }[] = [];
  if (f.from && f.to) {
    const payments = await prisma.payment.findMany({
      where: { schoolId: f.schoolId, status: { not: "cancelled" }, paidOn: { gte: f.from, lt: f.to } },
      select: { amount: true, paidOn: true },
    });
    const monthMap = new Map<string, number>();
    for (const p of payments) {
      const key = `${p.paidOn.getUTCFullYear()}-${String(p.paidOn.getUTCMonth() + 1).padStart(2, "0")}`;
      monthMap.set(key, (monthMap.get(key) ?? 0) + p.amount);
    }
    monthlyTrend = [...monthMap.entries()].map(([month, collected]) => ({ month, collected })).sort((a, b) => a.month.localeCompare(b.month));
  }

  return {
    totalCharged: totals.charged,
    totalPaid: totals.paid,
    totalPending: totals.pending,
    totalOverdue: totals.overdue,
    collectionPct: totals.charged > 0 ? Math.round((totals.paid / totals.charged) * 100) : 0,
    defaulterCount,
    monthlyTrend,
    classWise,
  };
}

export interface FeeDefaulter {
  studentId: string;
  name: string;
  className: string;
  sectionName: string | null;
  pending: number;
  overdue: number;
}

export async function getFeeDefaulters(f: FeesFilters): Promise<FeeDefaulter[]> {
  const students = await prisma.student.findMany({
    where: studentWhere(f),
    select: {
      id: true,
      firstName: true,
      lastName: true,
      class: { select: { name: true } },
      section: { select: { name: true } },
      feeCharges: { select: FEE_CHARGE_SELECT },
    },
  });

  return students
    .map((s) => {
      const summary = summarizeStudentFees(s.feeCharges);
      return {
        studentId: s.id,
        name: `${s.firstName} ${s.lastName}`,
        className: s.class.name,
        sectionName: s.section?.name ?? null,
        pending: summary.totalPending,
        overdue: summary.totalOverdue,
      };
    })
    .filter((s) => s.overdue > 0)
    .sort((a, b) => b.overdue - a.overdue);
}
