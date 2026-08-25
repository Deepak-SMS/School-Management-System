import { z } from "zod";
import { BLOOD_GROUPS, GENDERS } from "@/lib/constants/people";

/**
 * What a parent may submit through the public admission form.
 *
 * Deliberately narrower than the staff-facing student schema: a parent can't set
 * admission number, roll number, status, class assignment or anything else that
 * belongs to the school. Those are decided by staff when approving the
 * submission, which is why submissions land as `pending` rather than as students.
 */

const optionalString = z.string().trim().max(255).optional();
const optionalText = z.string().trim().max(1000).optional();

const phone = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || /^[0-9+\-\s()]{7,20}$/.test(v), "Invalid phone number");

const email = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || z.string().email().safeParse(v).success, "Invalid email address");

const guardianSchema = z.object({
  relationship: z.enum(["father", "mother", "guardian", "grandparent", "other"]),
  fullName: z.string().trim().min(1, "Name is required").max(150),
  mobile: phone,
  alternateMobile: phone,
  email,
  occupation: optionalString,
  organization: optionalString,
  designation: optionalString,
  education: optionalString,
  isPrimary: z.boolean().optional(),
  isEmergencyContact: z.boolean().optional(),
  isAuthorizedPickup: z.boolean().optional(),
});

export const publicRegistrationSchema = z.object({
  // Student
  firstName: z.string().trim().min(1, "First name is required").max(100),
  middleName: optionalString,
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  dateOfBirth: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date of birth"),
  gender: z.enum(GENDERS).optional(),
  bloodGroup: z.enum(BLOOD_GROUPS).optional(),
  nationality: optionalString,
  motherTongue: optionalString,
  previousSchool: optionalString,
  /** What the parent is applying for — staff confirm the actual class on approval. */
  appliedForClass: optionalString,

  // Address
  address: optionalText,
  addressLine2: optionalString,
  city: optionalString,
  state: optionalString,
  country: optionalString,
  pinCode: optionalString,
  sameAsCurrent: z.boolean().optional(),
  permanentAddress: optionalText,
  permanentCity: optionalString,
  permanentState: optionalString,
  permanentCountry: optionalString,
  permanentPinCode: optionalString,

  // Contact
  primaryMobile: phone,
  secondaryMobile: phone,
  studentEmail: email,
  parentEmail: email,
  whatsappNumber: phone,
  commChannels: z.array(z.enum(["whatsapp", "sms", "email", "phone", "app"])).max(5).optional(),

  // Emergency
  emergencyName: optionalString,
  emergencyRelation: optionalString,
  emergencyContact: phone,
  emergencyAltPhone: phone,
  emergencyAddress: optionalText,

  // Guardians — at least one, so every submission has someone to contact.
  guardians: z.array(guardianSchema).min(1, "Add at least one parent or guardian").max(4),
});

export type PublicRegistrationInput = z.infer<typeof publicRegistrationSchema>;

/** Staff decision on a submission. */
export const registrationReviewSchema = z
  .object({
    action: z.enum(["approve", "reject"]),
    reviewNote: z.string().trim().max(1000).optional(),
    // Supplied on approval — the school's own decisions, not the parent's.
    admissionNumber: z.string().trim().max(50).optional(),
    academicYearId: z.string().trim().optional(),
    classId: z.string().trim().optional(),
    sectionId: z.string().trim().optional(),
    rollNumber: optionalString,
  })
  .refine((v) => v.action !== "approve" || Boolean(v.admissionNumber && v.academicYearId && v.classId), {
    message: "Admission number, academic year and class are required to approve a submission",
    path: ["admissionNumber"],
  })
  .refine((v) => v.action !== "reject" || Boolean(v.reviewNote), {
    message: "A reason is required when rejecting a submission",
    path: ["reviewNote"],
  });
