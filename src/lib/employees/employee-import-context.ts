import { prisma } from "@/lib/db";
import type { EmployeeValidationContext } from "@/lib/employees/employee-import";

/**
 * Loads the school's masters once, so per-row import validation is in-memory
 * rather than a query per row.
 *
 * Lives here rather than in a route file because both the validate and commit
 * routes need it, and a `route.ts` may only export HTTP handlers.
 */
export async function buildEmployeeImportContext(schoolId: string): Promise<EmployeeValidationContext> {
  const [departments, employeeTypes, campuses, staff] = await Promise.all([
    prisma.department.findMany({ where: { schoolId }, select: { id: true, name: true } }),
    prisma.employeeType.findMany({ where: { schoolId }, select: { id: true, name: true } }),
    prisma.campus.findMany({ where: { schoolId }, select: { id: true, name: true } }),
    prisma.staff.findMany({ where: { schoolId }, select: { id: true, employeeId: true } }),
  ]);

  return {
    departments: new Map(departments.map((d) => [d.name.toLowerCase(), d.id])),
    employeeTypes: new Map(employeeTypes.map((t) => [t.name.toLowerCase(), t.id])),
    campuses: new Map(campuses.map((c) => [c.name.toLowerCase(), c.id])),
    employeeIds: new Map(staff.map((s) => [s.employeeId.toLowerCase(), s.id])),
  };
}
