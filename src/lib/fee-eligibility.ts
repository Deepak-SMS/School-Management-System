import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { chargeKey, chargeInputsForItem } from "@/lib/student-fee-charges";

export interface FeeStructureTarget {
  schoolId: string;
  academicYearId: string;
  classId?: string | null;
  sectionId?: string | null;
  studentCategoryId?: string | null;
}

/**
 * The "eligible students" rule for a fee structure: active students in the same
 * academic year, narrowed by whichever of class/section/fee-category the
 * structure targets. A null target field means "applies to everyone at that
 * level" (see FeeStructure in schema.prisma).
 */
export function eligibleStudentsWhere(target: FeeStructureTarget): Prisma.StudentWhereInput {
  return {
    schoolId: target.schoolId,
    academicYearId: target.academicYearId,
    status: "active",
    ...(target.classId && { classId: target.classId }),
    ...(target.sectionId && { sectionId: target.sectionId }),
    ...(target.studentCategoryId && { feeCategoryId: target.studentCategoryId }),
  };
}

export async function countEligibleStudents(target: FeeStructureTarget): Promise<number> {
  return prisma.student.count({ where: eligibleStudentsWhere(target) });
}

/**
 * Publish-time sync: creates a FeeStructureAssignment for every currently-
 * matching student who doesn't already have one, reactivates any previously
 * `removed` assignment whose student now matches again, and flips to `removed`
 * any `active` assignment whose student no longer matches (e.g. they changed
 * class). Assignments are never deleted — Invoices/Student Fees, built on top
 * of this join later, need the history even after a student stops matching.
 *
 * Idempotent by design: re-running it after new admissions only adds the newly
 * eligible students, so "Publish" doubles as a "Refresh assignments" action.
 *
 * Returns every currently-matching student id (not just newly-added ones) as
 * `assignedStudentIds`, so the caller can (re-)generate StudentFeeCharge rows
 * for the full active set in the same transaction — generateStudentFeeCharges
 * is existence-checked per charge, so passing the whole set every time is
 * both correct and self-healing (e.g. a structure published before charge
 * generation existed backfills on its next "Publish"/refresh) at the cost of
 * one cheap extra query, rather than only ever covering students who happened
 * to be newly (re-)assigned this specific run.
 */
export async function syncFeeStructureAssignments(
  tx: Prisma.TransactionClient,
  feeStructureId: string,
  target: FeeStructureTarget,
): Promise<{ newlyAssigned: number; totalAssigned: number; assignedStudentIds: string[] }> {
  const [matching, existing] = await Promise.all([
    tx.student.findMany({ where: eligibleStudentsWhere(target), select: { id: true } }),
    tx.feeStructureAssignment.findMany({ where: { feeStructureId } }),
  ]);

  const matchingIds = new Set(matching.map((s) => s.id));
  const existingByStudentId = new Map(existing.map((a) => [a.studentId, a]));

  const toCreate = [...matchingIds].filter((studentId) => !existingByStudentId.has(studentId));
  if (toCreate.length > 0) {
    await tx.feeStructureAssignment.createMany({
      data: toCreate.map((studentId) => ({ schoolId: target.schoolId, feeStructureId, studentId })),
    });
  }

  for (const assignment of existing) {
    const stillMatches = matchingIds.has(assignment.studentId);
    if (assignment.status === "active" && !stillMatches) {
      await tx.feeStructureAssignment.update({ where: { id: assignment.id }, data: { status: "removed", removedAt: new Date() } });
    } else if (assignment.status === "removed" && stillMatches) {
      await tx.feeStructureAssignment.update({ where: { id: assignment.id }, data: { status: "active", removedAt: null } });
    }
  }

  return { newlyAssigned: toCreate.length, totalAssigned: matchingIds.size, assignedStudentIds: [...matchingIds] };
}

/**
 * Materializes a student's fee account from a FeeStructure: one StudentFeeCharge
 * per FeeInstallment (or one lump-sum charge for an item with none), for every
 * *mandatory* item only — optional items are never auto-charged (a school
 * shouldn't be billed for transport they never opted into); an admin opts a
 * student into one from the Student Fees screen instead, which reuses this
 * same StudentFeeCharge shape with `isManual = false`.
 *
 * Existence-checked per (student, item, due date) rather than relying on a DB
 * unique constraint, because SQLite treats every NULL as distinct (same
 * caveat documented on the Attendance model) so a lump-sum item's null due
 * date couldn't be deduped by the database anyway. Safe to call repeatedly —
 * only ever adds the charges that are still missing.
 */
export async function generateStudentFeeCharges(
  tx: Prisma.TransactionClient,
  feeStructureId: string,
  studentIds: string[],
): Promise<number> {
  if (studentIds.length === 0) return 0;

  const [structure, items] = await Promise.all([
    tx.feeStructure.findUniqueOrThrow({ where: { id: feeStructureId }, select: { schoolId: true } }),
    tx.feeStructureItem.findMany({
      where: { feeStructureId, isOptional: false },
      include: { installments: true, feeCategory: { select: { name: true } } },
    }),
  ]);
  if (items.length === 0) return 0;

  const existing = await tx.studentFeeCharge.findMany({
    where: { feeStructureId, studentId: { in: studentIds } },
    select: { studentId: true, feeStructureItemId: true, dueDate: true },
  });
  const existingKeys = new Set(
    existing.map((c) => chargeKey(c.studentId, c.feeStructureItemId ?? "", c.dueDate)),
  );

  const toCreate: Prisma.StudentFeeChargeCreateManyInput[] = [];
  for (const studentId of studentIds) {
    for (const item of items) {
      const inputs = chargeInputsForItem(structure.schoolId, studentId, item);
      const dueDates: (Date | null)[] = item.installments.length === 0 ? [null] : item.installments.map((i) => i.dueDate);
      inputs.forEach((input, index) => {
        const key = chargeKey(studentId, item.id, dueDates[index]);
        if (existingKeys.has(key)) return;
        toCreate.push(input);
      });
    }
  }

  if (toCreate.length > 0) {
    await tx.studentFeeCharge.createMany({ data: toCreate });
  }
  return toCreate.length;
}
