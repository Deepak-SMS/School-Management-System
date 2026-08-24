/**
 * Permission vocabulary, expressed as `module × action`.
 *
 * The spec lists permissions as dotted strings (`employee.salary`,
 * `candidate.convert`). Those map onto this matrix rather than introducing a
 * second scheme — e.g. `employee.salary` is `employeeSalary:view`, and
 * `candidate.convert` is `candidates:convert`. Keeping one shape means the
 * School Management modules already using `hasPermission()` keep working.
 *
 * Salary/bank data sits in its own module (`employeeSalary`) precisely so it can
 * be granted separately from ordinary employee access, per spec §2.17.
 */
export type PermissionModule =
  // School Management (existing)
  | "schoolProfile"
  | "campuses"
  | "academicYears"
  | "classes"
  | "sections"
  | "subjects"
  | "departments"
  // HR — people
  | "hrDashboard"
  | "employees"
  | "employeeSalary"
  | "employeeDocuments"
  | "designations"
  | "employeeTypes"
  // HR — modules that arrive in later phases; listed now so the matrix is
  // complete and route guards don't need re-shaping when they land.
  | "employeeAttendance"
  | "employeePerformance"
  // Recruitment
  | "recruitment"
  | "vacancies"
  | "candidates"
  | "interviews"
  | "offers";

export type PermissionAction =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "export"
  | "import"
  | "activate"
  | "deactivate"
  | "approve"
  | "transfer"
  | "verify"
  | "screen"
  | "evaluate"
  | "select"
  | "convert";

/** A single permission as a readable string, used in error messages and audit entries. */
export function permissionKey(module: PermissionModule, action: PermissionAction): string {
  return `${module}:${action}`;
}
