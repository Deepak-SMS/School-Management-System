import { z } from "zod";
import { BLOOD_GROUPS, GENDERS, STUDENT_STATUSES } from "@/lib/constants/people";
import { ADMISSION_TYPES, PROMOTION_STATUSES } from "@/lib/constants/student-documents";

const optionalString = z.string().trim().max(255).optional();
const optionalText = z.string().trim().max(1000).optional();

const phonePattern = /^[0-9+\-\s()]{7,20}$/;

const optionalPhone = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || phonePattern.test(v), "Invalid phone number");

const optionalEmail = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || z.string().email().safeParse(v).success, "Invalid email address");

const requiredEmail = z
  .string()
  .trim()
  .min(1, "Email is required")
  .refine((v) => z.string().email().safeParse(v).success, "Invalid email address");

const optionalDate = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date");

/**
 * A parent or guardian captured on the admission form.
 *
 * `relationship` decides which of the three blocks it came from; the record
 * itself is the same shape either way, because a guardian is a person however
 * they're related to the child.
 */
export const studentGuardianInputSchema = z.object({
  relationship: z.enum(["father", "mother", "guardian", "grandparent", "other"]),
  fullName: z.string().trim().min(1, "Name is required").max(150),
  mobile: optionalPhone,
  alternateMobile: optionalPhone,
  email: optionalEmail,
  occupation: optionalString,
  /** Employer, stored on Guardian.organization. */
  organization: optionalString,
  /** Highest qualification, stored on Guardian.education. */
  education: optionalString,
  address: optionalText,
  isPrimary: z.boolean().optional(),
  isEmergencyContact: z.boolean().optional(),
  isAuthorizedPickup: z.boolean().optional(),
  canReceiveAcademic: z.boolean().optional(),
  canReceiveFee: z.boolean().optional(),
});

export type StudentGuardianInput = z.infer<typeof studentGuardianInputSchema>;

export const studentInputSchema = z.object({
  // --- Student information ---
  admissionNumber: z.string().trim().min(1, "Admission number is required").max(50),
  /** The school's own student ID, distinct from the admission number. */
  enrollmentNumber: optionalString,
  firstName: z.string().trim().min(1, "First name is required").max(100),
  middleName: optionalString,
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  photoUrl: optionalString,
  photoFileId: optionalString,
  dateOfBirth: optionalDate,
  gender: z.enum(GENDERS).optional(),
  bloodGroup: z.enum(BLOOD_GROUPS).optional(),
  nationality: optionalString,
  motherTongue: optionalString,
  /**
   * Category, religion and government ID are optional throughout and never
   * required to save a student — they exist only for schools legally obliged to
   * report them.
   */
  category: optionalString,
  religion: optionalString,
  govtIdRef: optionalString,

  // --- Admission ---
  previousSchool: optionalString,
  previousClass: optionalString,
  admissionDate: optionalDate,
  admissionType: z.enum(ADMISSION_TYPES).optional(),

  // --- Academic placement ---
  academicYearId: z.string().min(1, "Academic year is required"),
  classId: z.string().min(1, "Class is required"),
  sectionId: optionalString,
  rollNumber: optionalString,
  house: optionalString,
  stream: optionalString,
  medium: optionalString,
  promotionStatus: z.enum(PROMOTION_STATUSES).optional(),
  status: z.enum(STUDENT_STATUSES).optional(),

  // --- Address ---
  address: optionalText,
  addressLine2: optionalString,
  city: optionalString,
  district: optionalString,
  state: optionalString,
  country: optionalString,
  pinCode: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^[0-9A-Za-z\s-]{3,12}$/.test(v), "Invalid PIN code"),
  sameAsCurrent: z.boolean().optional(),
  permanentAddress: optionalText,
  permanentLine2: optionalString,
  permanentCity: optionalString,
  permanentDistrict: optionalString,
  permanentState: optionalString,
  permanentCountry: optionalString,
  permanentPinCode: optionalString,

  // --- Contact ---
  primaryMobile: optionalPhone,
  secondaryMobile: optionalPhone,
  studentEmail: requiredEmail,
  parentEmail: requiredEmail,
  whatsappNumber: optionalPhone,

  // --- Emergency ---
  emergencyName: optionalString,
  emergencyRelation: optionalString,
  emergencyContact: optionalPhone,
  emergencyAltPhone: optionalPhone,
  emergencyAddress: optionalText,

  // --- Transport ---
  busNumber: optionalString,
  route: optionalString,
  pickupPoint: optionalString,

  /**
   * Parents and guardians created alongside the student. Optional so an office
   * can enrol first and add contacts later, rather than being blocked at the
   * counter.
   */
  guardians: z.array(studentGuardianInputSchema).max(4).optional(),
});

export type StudentInput = z.infer<typeof studentInputSchema>;

/**
 * Same shape as studentInputSchema, but the contact emails stay optional.
 * Used by the edit form/route so an existing student saved before these
 * became required isn't blocked from saving unrelated changes.
 */
export const studentEditInputSchema = studentInputSchema.extend({
  studentEmail: optionalEmail,
  parentEmail: optionalEmail,
});

/** Applied by the create route; deliberately not a schema default, which would fire under `.partial()`. */
export const DEFAULT_STUDENT_STATUS = "active";

export { cleanEmptyStrings } from "./shared";
