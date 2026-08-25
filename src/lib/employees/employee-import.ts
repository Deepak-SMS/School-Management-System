import { BLOOD_GROUPS, GENDERS, STAFF_CATEGORIES } from "@/lib/constants/people";
import { EMPLOYMENT_STATUSES, MARITAL_STATUSES } from "@/lib/constants/hr";
import {
  type ImportColumn,
  type ParsedRow,
  type RowError,
  validateColumnRules,
  PHONE_RE,
  EMAIL_RE,
} from "@/lib/csv-import";

/**
 * Employee bulk import.
 *
 * Department, designation and employee type are matched **by name** against the
 * school's own master tables — an administrator filling in a spreadsheet knows
 * "Finance", not a cuid. Unknown names are reported as errors rather than
 * silently created, so a typo can't quietly spawn a duplicate department.
 *
 * Bank and PAN columns are deliberately absent: pay data requires the separate
 * `employeeSalary` permission, and a spreadsheet passed around an office is the
 * wrong place for it. It's entered on the employee's profile instead.
 */
export const EMPLOYEE_IMPORT_COLUMNS: ImportColumn[] = [
  // Identity
  { header: "Employee ID", field: "employeeId", example: "", hint: "Leave blank to generate the next ID automatically" },
  { header: "First Name", field: "firstName", required: true, example: "Priya" },
  { header: "Middle Name", field: "middleName", example: "" },
  { header: "Last Name", field: "lastName", example: "Nair" },
  { header: "Date of Birth", field: "dateOfBirth", example: "1990-06-14", hint: "YYYY-MM-DD" },
  { header: "Gender", field: "gender", example: "female", allowed: GENDERS },
  { header: "Blood Group", field: "bloodGroup", example: "B+", allowed: BLOOD_GROUPS },
  { header: "Marital Status", field: "maritalStatus", example: "", allowed: MARITAL_STATUSES },

  // Placement — matched by name against your own masters
  {
    header: "Category",
    field: "category",
    required: true,
    example: "teacher",
    allowed: STAFF_CATEGORIES,
    hint: "Teaching or non-teaching role type",
  },
  { header: "Department", field: "departmentName", example: "Academics", hint: "Must match an existing department name" },
  { header: "Designation", field: "designationName", example: "Mathematics Teacher", hint: "Created if it doesn't exist yet" },
  { header: "Employee Type", field: "employeeTypeName", example: "Permanent", hint: "Must match an existing employee type" },
  { header: "Campus", field: "campusName", example: "", hint: "Must match an existing campus name" },
  { header: "Work Location", field: "workLocation", example: "" },
  { header: "Reporting Manager Employee ID", field: "managerEmployeeId", example: "", hint: "The manager's employee ID, not their name" },

  // Employment
  { header: "Joining Date", field: "joiningDate", example: "2026-06-01", hint: "YYYY-MM-DD" },
  { header: "Confirmation Date", field: "confirmationDate", example: "" },
  { header: "Probation Months", field: "probationMonths", example: "6" },
  { header: "Employment Status", field: "employmentStatus", example: "active", allowed: EMPLOYMENT_STATUSES },

  // Contact
  { header: "Mobile Number", field: "mobileNumber", required: true, example: "+91 9812345678" },
  { header: "Alternate Number", field: "alternateNumber", example: "" },
  { header: "Personal Email", field: "email", example: "priya@example.com" },
  { header: "Official Email", field: "officialEmail", example: "" },

  // Address
  { header: "Address", field: "address", example: "22 Garden Street" },
  { header: "City", field: "city", example: "Pune" },
  { header: "State", field: "state", example: "Maharashtra" },
  { header: "Country", field: "country", example: "India" },
  { header: "PIN Code", field: "pinCode", example: "411045" },

  // Emergency
  { header: "Emergency Contact Name", field: "emergencyName", example: "Ravi Nair" },
  { header: "Emergency Relationship", field: "emergencyRelation", example: "Spouse" },
  { header: "Emergency Mobile", field: "emergencyContact", example: "+91 9899999999" },
];

export const EMPLOYEE_IMPORT_NOTES = [
  "Department, Employee Type and Campus must already exist — create them first if they don't.",
  "Designation is created automatically if it doesn't exist.",
  "Bank and PAN details aren't imported; add them on the employee's profile (they need salary permission).",
];

export interface EmployeeValidationContext {
  /** Lowercased department name -> id. */
  departments: Map<string, string>;
  /** Lowercased employee type name -> id. */
  employeeTypes: Map<string, string>;
  /** Lowercased campus name -> id. */
  campuses: Map<string, string>;
  /** Lowercased employee id -> staff id, for resolving reporting managers. */
  employeeIds: Map<string, string>;
}

/** Validates one row; an empty array means the row is importable. */
export function validateEmployeeRow(
  row: ParsedRow,
  context: EmployeeValidationContext,
  seenInFile: Set<string>,
): RowError[] {
  const errors = validateColumnRules(row, EMPLOYEE_IMPORT_COLUMNS);
  const v = row.values;
  const at = (column: string, message: string, rawValue?: string) =>
    errors.push({ lineNumber: row.lineNumber, column, message, rawValue });

  // Employee ID is optional (generated when blank) but must be unique if given.
  const employeeId = v.employeeId?.trim();
  if (employeeId) {
    const key = employeeId.toLowerCase();
    if (context.employeeIds.has(key)) {
      at("Employee ID", `An employee with ID "${employeeId}" already exists.`, employeeId);
    } else if (seenInFile.has(key)) {
      at("Employee ID", `Employee ID "${employeeId}" appears more than once in this file.`, employeeId);
    }
    seenInFile.add(key);
  }

  if (v.departmentName && !context.departments.has(v.departmentName.toLowerCase())) {
    at("Department", `Department "${v.departmentName}" does not exist.`, v.departmentName);
  }
  if (v.employeeTypeName && !context.employeeTypes.has(v.employeeTypeName.toLowerCase())) {
    at("Employee Type", `Employee type "${v.employeeTypeName}" does not exist.`, v.employeeTypeName);
  }
  if (v.campusName && !context.campuses.has(v.campusName.toLowerCase())) {
    at("Campus", `Campus "${v.campusName}" does not exist.`, v.campusName);
  }

  // A manager must already be on staff — a row can't report to someone created
  // later in the same file, because ordering would decide whether it works.
  if (v.managerEmployeeId && !context.employeeIds.has(v.managerEmployeeId.toLowerCase())) {
    at(
      "Reporting Manager Employee ID",
      `No employee has ID "${v.managerEmployeeId}". Import the manager first, or leave this blank.`,
      v.managerEmployeeId,
    );
  }

  for (const [field, header] of [
    ["dateOfBirth", "Date of Birth"],
    ["joiningDate", "Joining Date"],
    ["confirmationDate", "Confirmation Date"],
  ] as const) {
    const value = v[field];
    if (value && Number.isNaN(Date.parse(value))) {
      at(header, `"${value}" isn't a valid date. Use YYYY-MM-DD.`, value);
    }
  }

  for (const [field, header] of [
    ["mobileNumber", "Mobile Number"],
    ["alternateNumber", "Alternate Number"],
    ["emergencyContact", "Emergency Mobile"],
  ] as const) {
    const value = v[field];
    if (value && !PHONE_RE.test(value)) at(header, `"${value}" isn't a valid phone number.`, value);
  }

  for (const [field, header] of [
    ["email", "Personal Email"],
    ["officialEmail", "Official Email"],
  ] as const) {
    const value = v[field];
    if (value && !EMAIL_RE.test(value)) at(header, `"${value}" isn't a valid email address.`, value);
  }

  const probation = v.probationMonths;
  if (probation && (!/^\d+$/.test(probation) || Number(probation) > 60)) {
    at("Probation Months", `"${probation}" isn't a whole number of months (0–60).`, probation);
  }

  return errors;
}
