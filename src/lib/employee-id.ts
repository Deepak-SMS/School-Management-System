import type { Prisma } from "@/generated/prisma/client";

/**
 * Generates the next employee ID for a school, e.g. `EMP-000124`.
 *
 * The format is a per-school setting rather than a hardcoded rule (spec §29
 * "Employee ID format"). Until a school-settings table exists, the defaults live
 * here and are overridable per call — no school-specific values are baked in.
 *
 * Must be called inside the same transaction as the Staff insert: it derives the
 * next number from existing rows, so two concurrent creates outside a
 * transaction could collide. The DB's `@@unique([schoolId, employeeId])` is the
 * backstop — a collision surfaces as a 409, never as a duplicate employee.
 */

export interface EmployeeIdFormat {
  prefix: string;
  separator: string;
  padding: number;
}

export const DEFAULT_EMPLOYEE_ID_FORMAT: EmployeeIdFormat = {
  prefix: "EMP",
  separator: "-",
  padding: 6,
};

export function formatEmployeeId(sequence: number, format: EmployeeIdFormat = DEFAULT_EMPLOYEE_ID_FORMAT): string {
  return `${format.prefix}${format.separator}${String(sequence).padStart(format.padding, "0")}`;
}

export async function generateEmployeeId(
  tx: Prisma.TransactionClient,
  schoolId: string,
  format: EmployeeIdFormat = DEFAULT_EMPLOYEE_ID_FORMAT,
): Promise<string> {
  const existing = await tx.staff.findMany({
    where: { schoolId, employeeId: { startsWith: `${format.prefix}${format.separator}` } },
    select: { employeeId: true },
  });

  // Parse the numeric tail of each existing id and continue from the highest.
  // Ids that don't match the current format are ignored rather than causing a
  // reset, so changing the format later never reissues an existing number.
  const highest = existing.reduce((max, { employeeId }) => {
    const tail = employeeId.slice(format.prefix.length + format.separator.length);
    const parsed = Number.parseInt(tail, 10);
    return Number.isFinite(parsed) && parsed > max ? parsed : max;
  }, 0);

  return formatEmployeeId(highest + 1, format);
}
