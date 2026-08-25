import type { Role } from "@/types/user";
import type { PermissionAction, PermissionModule } from "@/types/permissions";

const SCHOOL_MODULES: PermissionModule[] = [
  "schoolProfile",
  "campuses",
  "academicYears",
  "classes",
  "sections",
  "subjects",
  "departments",
];

/** HR modules excluding salary — salary is granted separately and deliberately. */
const HR_PEOPLE_MODULES: PermissionModule[] = [
  "hrDashboard",
  "employees",
  "employeeDocuments",
  "designations",
  "employeeTypes",
  "employeeAttendance",
  "employeePerformance",
];

const RECRUITMENT_MODULES: PermissionModule[] = ["recruitment", "vacancies", "candidates", "interviews", "offers"];

/** Student records, their guardians, and parent-submitted admission forms. */
const STUDENT_MODULES: PermissionModule[] = ["students", "guardians", "studentRegistrations"];

const ALL_MODULES: PermissionModule[] = [
  ...SCHOOL_MODULES,
  ...STUDENT_MODULES,
  ...HR_PEOPLE_MODULES,
  ...RECRUITMENT_MODULES,
  "employeeSalary",
];

const EVERY_ACTION: PermissionAction[] = [
  "view",
  "create",
  "edit",
  "delete",
  "export",
  "import",
  "activate",
  "deactivate",
  "approve",
  "transfer",
  "verify",
  "screen",
  "evaluate",
  "select",
  "convert",
];

const VIEW_EXPORT_EDIT: PermissionAction[] = ["view", "create", "edit", "export", "activate", "deactivate"];
const VIEW_EXPORT: PermissionAction[] = ["view", "export"];
const VIEW_ONLY: PermissionAction[] = ["view"];

function grant(
  modules: PermissionModule[],
  actions: PermissionAction[],
): Partial<Record<PermissionModule, PermissionAction[]>> {
  return Object.fromEntries(modules.map((m) => [m, actions]));
}

/**
 * Role → permission matrix for School Management + HR + Recruitment.
 *
 * This is the single source of truth for authorization. It is enforced
 * server-side by `requirePermission()` (src/lib/authorize.ts) on every mutating
 * HR route, and reused client-side by `useCan()` to hide controls the user
 * cannot use. Hiding alone is never the control — the server check is.
 *
 * Deliberate separations:
 * - `employeeSalary` (bank/PAN/salary) is granted only to HR Admin, School
 *   Admin, Super Admin and Accountant — not to Principal, HR Staff or HOD.
 * - Recruitment roles get no payroll access (spec §3.18).
 * - `teacher` holds no HR-wide grants; employees reach their own record through
 *   Employee Self-Service, which scopes by staff id rather than by role.
 */
export const ROLE_PERMISSIONS: Record<Role, Partial<Record<PermissionModule, PermissionAction[]>>> = {
  super_admin: grant(ALL_MODULES, EVERY_ACTION),
  school_admin: grant(ALL_MODULES, EVERY_ACTION),

  // HR Admin — full HR management, including sensitive pay data. Student records
  // are not HR's to edit, so they get read access only.
  hr: {
    ...grant(SCHOOL_MODULES, VIEW_EXPORT),
    ...grant(STUDENT_MODULES, VIEW_EXPORT),
    ...grant(HR_PEOPLE_MODULES, EVERY_ACTION),
    ...grant(RECRUITMENT_MODULES, EVERY_ACTION),
    employeeSalary: ["view", "create", "edit", "export"],
  },

  // HR Staff — day-to-day HR operations, but cannot see pay data, delete
  // employees, or convert a candidate into an employee.
  hr_staff: {
    ...grant(SCHOOL_MODULES, VIEW_ONLY),
    ...grant(STUDENT_MODULES, VIEW_ONLY),
    ...grant(HR_PEOPLE_MODULES, ["view", "create", "edit", "export", "verify"]),
    ...grant(RECRUITMENT_MODULES, ["view", "create", "edit", "export", "screen", "evaluate"]),
  },

  // Principal — oversight across students, employees and hiring; no pay data.
  // Can approve parent-submitted admissions but not bulk-import or delete.
  principal: {
    ...grant(SCHOOL_MODULES, VIEW_EXPORT_EDIT),
    ...grant(STUDENT_MODULES, ["view", "create", "edit", "export", "approve"]),
    ...grant(HR_PEOPLE_MODULES, ["view", "export", "approve"]),
    ...grant(RECRUITMENT_MODULES, ["view", "export", "evaluate", "select", "approve"]),
  },

  // HOD — manages their own department's staff. Row-level scoping to that
  // department is applied in the route on top of this grant.
  hod: {
    ...grant(["departments", "classes", "sections", "subjects"], VIEW_ONLY),
    hrDashboard: ["view"],
    employees: ["view", "export"],
    employeeAttendance: ["view", "export", "approve"],
    employeePerformance: ["view", "create", "edit", "evaluate"],
    interviews: ["view", "evaluate"],
    candidates: ["view"],
    vacancies: ["view"],
  },

  // Accountant — payroll-facing: pay data plus enough employee context to use it.
  accountant: {
    hrDashboard: ["view"],
    employees: ["view", "export"],
    employeeSalary: ["view", "export"],
  },

  // Teachers see the students they teach, but never edit the roster or the
  // guardian contact details behind it.
  teacher: {
    ...grant(["classes", "sections", "subjects", "departments"], VIEW_EXPORT),
    students: ["view", "export"],
  },
  librarian: grant(["departments"], VIEW_ONLY),
  transport_manager: grant(["departments"], VIEW_ONLY),
  hostel_manager: grant(["departments"], VIEW_ONLY),
  parent: {},
  student: {},
};

export function hasPermission(role: Role, module: PermissionModule, action: PermissionAction): boolean {
  return ROLE_PERMISSIONS[role]?.[module]?.includes(action) ?? false;
}

/** True if the role can see salary/bank/PAN fields — the one check worth naming. */
export function canViewSensitivePay(role: Role): boolean {
  return hasPermission(role, "employeeSalary", "view");
}
