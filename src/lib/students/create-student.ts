import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { buildStudentGuardianCreates } from "./guardian-input";
import { createQrVerification } from "@/lib/qr-verification";
import { recordAudit } from "@/lib/audit";
import { cleanEmptyStrings, DEFAULT_STUDENT_STATUS, type StudentInput } from "@/lib/validation/student";

/** Thrown when the chosen academic year, class or section doesn't check out for this school. */
export class StudentPlacementError extends Error {
  status: number;
  constructor(message: string, status = 404) {
    super(message);
    this.status = status;
  }
}

/**
 * Confirms the academic year, class and (if given) section belong to this
 * school and to each other. Shared by every path that creates a student — the
 * "Add student" form and admission approval alike — so a guessed id can't
 * enrol someone into another tenant's class either way.
 */
export async function validateStudentPlacement(
  schoolId: string,
  input: Pick<StudentInput, "academicYearId" | "classId" | "sectionId">,
): Promise<void> {
  const [academicYear, cls] = await Promise.all([
    prisma.academicYear.findFirst({ where: { id: input.academicYearId, schoolId }, select: { id: true } }),
    prisma.class.findFirst({ where: { id: input.classId, schoolId }, select: { id: true } }),
  ]);
  if (!academicYear) throw new StudentPlacementError("Academic year not found.");
  if (!cls) throw new StudentPlacementError("Class not found.");

  if (input.sectionId) {
    const section = await prisma.section.findFirst({
      where: { id: input.sectionId, schoolId, classId: input.classId },
      select: { id: true },
    });
    if (!section) throw new StudentPlacementError("That section doesn't belong to the selected class.", 422);
  }
}

/**
 * Writes the student + guardians inside the caller's transaction.
 *
 * Used both for a direct "Add student" submission and for approving an
 * admission application, so a student created either way — walk-in or
 * parent-submitted — ends up built exactly the same way. Call
 * `validateStudentPlacement` first; this assumes the placement already checks out.
 */
export async function createStudentWithGuardians(
  tx: Prisma.TransactionClient,
  schoolId: string,
  userId: string,
  rawInput: StudentInput,
  auditAction = "student.create",
) {
  const { guardians, ...input } = cleanEmptyStrings(rawInput);

  const created = await tx.student.create({
    data: {
      schoolId,
      ...input,
      status: input.status ?? DEFAULT_STUDENT_STATUS,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
      admissionDate: input.admissionDate ? new Date(input.admissionDate) : undefined,
      guardians: { create: buildStudentGuardianCreates(schoolId, guardians) },
    },
  });

  await createQrVerification(tx, { schoolId, studentId: created.id });
  await recordAudit(tx, {
    schoolId,
    userId,
    action: auditAction,
    entityType: "Student",
    entityId: created.id,
    after: { admissionNumber: created.admissionNumber, name: `${created.firstName} ${created.lastName}` },
  });

  return created;
}
