import { prisma } from "@/lib/db";

/** Thrown when an admission number collides with another student already on file for this school. */
export class DuplicateAdmissionNumberError extends Error {
  constructor() {
    super("This admission number is already in use.");
    this.name = "DuplicateAdmissionNumberError";
  }
}

/** True if another student in this school already has this admission number. */
export async function isAdmissionNumberTaken(
  schoolId: string,
  admissionNumber: string,
  excludeStudentId?: string,
): Promise<boolean> {
  const existing = await prisma.student.findFirst({
    where: { schoolId, admissionNumber, ...(excludeStudentId && { id: { not: excludeStudentId } }) },
    select: { id: true },
  });
  return existing !== null;
}

/**
 * Backstop for the create/edit routes — the inline check on the form catches
 * this first, but two people saving the same suggested number at once, or a
 * client that skipped the check, still need to be rejected here.
 */
export async function assertAdmissionNumberAvailable(
  schoolId: string,
  admissionNumber: string,
  excludeStudentId?: string,
): Promise<void> {
  if (await isAdmissionNumberTaken(schoolId, admissionNumber, excludeStudentId)) {
    throw new DuplicateAdmissionNumberError();
  }
}

/**
 * Suggests a fresh admission number in this school's existing numbering
 * pattern (prefix + zero-padded sequence) that isn't already taken — a
 * convenience default for the "Add student" form. Staff can always overwrite
 * it, so this only needs to be a reasonable guess, not authoritative.
 */
export async function suggestAdmissionNumber(schoolId: string): Promise<string> {
  const students = await prisma.student.findMany({ where: { schoolId }, select: { admissionNumber: true } });

  const pattern = /^(\D*)(\d+)$/;
  let prefix = "ADM";
  let width = 3;
  let max = 0;
  const taken = new Set<string>();
  for (const { admissionNumber } of students) {
    taken.add(admissionNumber);
    const match = admissionNumber.match(pattern);
    if (!match) continue;
    const value = Number(match[2]);
    if (value > max) {
      max = value;
      prefix = match[1] || prefix;
      width = match[2].length;
    }
  }

  let candidate: string;
  let next = max + 1;
  do {
    candidate = `${prefix}${String(next).padStart(width, "0")}`;
    next += 1;
  } while (taken.has(candidate));

  return candidate;
}
