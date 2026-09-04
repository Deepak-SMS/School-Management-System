import type { Prisma } from "@/generated/prisma/client";

interface ItemForCharging {
  id: string;
  feeStructureId: string;
  feeCategoryId: string;
  amount: number;
  installments: { label: string; dueDate: Date; amount: number }[];
  feeCategory: { name: string };
}

/** Identifies one (student, item, due date) charge slot — used to dedupe before creating, since SQLite treats every NULL as distinct so a lump-sum item's null due date can't be deduped by a DB unique constraint (same caveat documented on the Attendance model). */
export function chargeKey(studentId: string, feeStructureItemId: string, dueDate: Date | null): string {
  return `${studentId}:${feeStructureItemId}:${dueDate ? dueDate.toISOString() : "lump"}`;
}

/**
 * The charge row(s) one fee structure item produces for one student — a
 * single lump-sum row for an item with no installments, or one row per
 * installment. Pure and side-effect free so it's shared by the bulk
 * publish-time generator (src/lib/fee-eligibility.ts) and the single-item
 * opt-in route (POST /api/students/[id]/fees/charges).
 */
export function chargeInputsForItem(
  schoolId: string,
  studentId: string,
  item: ItemForCharging,
): Prisma.StudentFeeChargeCreateManyInput[] {
  if (item.installments.length === 0) {
    return [
      {
        schoolId,
        studentId,
        feeStructureId: item.feeStructureId,
        feeStructureItemId: item.id,
        feeCategoryId: item.feeCategoryId,
        label: item.feeCategory.name,
        amount: item.amount,
        dueDate: null,
      },
    ];
  }
  return item.installments.map((installment) => ({
    schoolId,
    studentId,
    feeStructureId: item.feeStructureId,
    feeStructureItemId: item.id,
    feeCategoryId: item.feeCategoryId,
    label: `${item.feeCategory.name} — ${installment.label}`,
    amount: installment.amount,
    dueDate: installment.dueDate,
  }));
}
