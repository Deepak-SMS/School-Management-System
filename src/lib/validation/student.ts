import { z } from "zod";
import { BLOOD_GROUPS, GENDERS, STUDENT_STATUSES } from "@/lib/constants/people";

const optionalString = z.string().trim().max(255).optional();

export const studentInputSchema = z.object({
  admissionNumber: z.string().trim().min(1, "Admission number is required").max(50),
  firstName: z.string().trim().min(1, "First name is required").max(100),
  middleName: optionalString,
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  photoUrl: optionalString,
  dateOfBirth: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date of birth"),
  gender: z.enum(GENDERS).optional(),
  bloodGroup: z.enum(BLOOD_GROUPS).optional(),
  academicYearId: z.string().min(1, "Academic year is required"),
  classId: z.string().min(1, "Class is required"),
  sectionId: optionalString,
  rollNumber: optionalString,
  house: optionalString,
  status: z.enum(STUDENT_STATUSES).default("active"),
  guardianName: optionalString,
  guardianPhone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^[0-9+\-\s()]{7,20}$/.test(v), "Invalid phone number"),
  emergencyContact: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^[0-9+\-\s()]{7,20}$/.test(v), "Invalid phone number"),
  address: optionalString,
  city: optionalString,
  state: optionalString,
  country: optionalString,
  pinCode: optionalString,
  busNumber: optionalString,
  route: optionalString,
  pickupPoint: optionalString,
});

export type StudentInput = z.infer<typeof studentInputSchema>;

export { cleanEmptyStrings } from "./shared";
