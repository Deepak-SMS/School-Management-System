import { z } from "zod";
import { BLOOD_GROUPS, GENDERS, STAFF_CATEGORIES } from "@/lib/constants/people";
import { EMPLOYMENT_STATUSES, MARITAL_STATUSES } from "@/lib/constants/hr";

const optionalString = z.string().trim().max(255).optional();
const optionalLongString = z.string().trim().max(1000).optional();

const phonePattern = /^[0-9+\-\s()]{7,20}$/;

const optionalPhone = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || phonePattern.test(v), "Invalid phone number");

const optionalDate = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date");

const optionalEmail = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || z.string().email().safeParse(v).success, "Invalid email address");

/**
 * Builds the denormalized `Staff.fullName` display column from its parts.
 *
 * `fullName` is derived, never entered directly: ~46 call sites across academics
 * and ID cards select a single name string for dropdowns and labels, so it stays
 * a stored column that the API recomposes on every write.
 */
export function composeFullName(parts: {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
}): string {
  return [parts.firstName, parts.middleName, parts.lastName]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");
}

export const staffInputSchema = z.object({
  // Step 1 — Personal
  /**
   * Optional on purpose: when omitted or blank the API generates the next id in
   * the school's configured format (see src/lib/employee-id.ts). Supplying one
   * lets a school keep its existing numbering during migration.
   */
  employeeId: z.string().trim().max(50).optional(),
  firstName: z.string().trim().min(1, "First name is required").max(80),
  middleName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  preferredName: optionalString,
  photoUrl: optionalString,
  photoFileId: optionalString,
  dateOfBirth: optionalDate,
  gender: z.enum(GENDERS).optional(),
  bloodGroup: z.enum(BLOOD_GROUPS).optional(),
  maritalStatus: z.enum(MARITAL_STATUSES).optional(),

  // Step 2 — Contact
  mobileNumber: z.string().trim().refine((v) => phonePattern.test(v), "Invalid phone number"),
  alternateNumber: optionalPhone,
  email: optionalEmail,
  officialEmail: optionalEmail,
  address: optionalLongString,
  permanentAddress: optionalLongString,
  city: optionalString,
  state: optionalString,
  country: optionalString,
  pinCode: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^[0-9A-Za-z\s-]{3,12}$/.test(v), "Invalid PIN code"),
  emergencyName: optionalString,
  emergencyRelation: optionalString,
  emergencyContact: optionalPhone,
  emergencyAddress: optionalLongString,

  // Step 3 — Employment
  category: z.enum(STAFF_CATEGORIES),
  designationId: optionalString,
  departmentId: optionalString,
  campusId: optionalString,
  employeeTypeId: optionalString,
  reportingManagerId: optionalString,
  workLocation: optionalString,
  joiningDate: optionalDate,
  confirmationDate: optionalDate,
  probationEndDate: optionalDate,
  probationMonths: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().min(0).max(60).optional(),
  ),
  /**
   * No `.default()` here on purpose. Zod still applies defaults under
   * `.partial()`, so a default would make every PATCH that omits this field
   * silently reset the employee to "active" — flipping someone on notice period
   * back to active during an unrelated edit. The create route applies the
   * default explicitly instead (see DEFAULT_EMPLOYMENT_STATUS).
   */
  employmentStatus: z.enum(EMPLOYMENT_STATUSES).optional(),

  // Step 6 — Bank/payroll. Permission-gated: routes reject these for callers
  // without `employeeSalary:edit` rather than silently dropping them.
  panNumber: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^[A-Za-z0-9]{6,20}$/.test(v), "Invalid PAN"),
  bankName: optionalString,
  bankAccountNumber: optionalString,
  bankIfsc: optionalString,
  bankAccountHolder: optionalString,
  pfNumber: optionalString,
  esicNumber: optionalString,
});

export type StaffInput = z.infer<typeof staffInputSchema>;

/** Applied by the create route; deliberately not a schema default (see above). */
export const DEFAULT_EMPLOYMENT_STATUS = "active";

/** Keys that require `employeeSalary:edit` to write. */
export const SENSITIVE_STAFF_INPUT_KEYS = [
  "panNumber",
  "bankName",
  "bankAccountNumber",
  "bankIfsc",
  "bankAccountHolder",
  "pfNumber",
  "esicNumber",
] as const satisfies readonly (keyof StaffInput)[];

export const staffEducationSchema = z.object({
  degree: z.string().trim().min(1, "Qualification is required").max(150),
  institution: optionalString,
  board: optionalString,
  passingYear: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().min(1900).max(2200).optional(),
  ),
  percentage: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().min(0).max(100).optional(),
  ),
  uploadedFileId: optionalString,
});

export type StaffEducationInput = z.infer<typeof staffEducationSchema>;

export const staffExperienceSchema = z
  .object({
    organization: z.string().trim().min(1, "Organization is required").max(150),
    designation: optionalString,
    startDate: optionalDate,
    endDate: optionalDate,
    description: optionalLongString,
    uploadedFileId: optionalString,
  })
  .refine((v) => !v.startDate || !v.endDate || new Date(v.startDate) <= new Date(v.endDate), {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  });

export type StaffExperienceInput = z.infer<typeof staffExperienceSchema>;
