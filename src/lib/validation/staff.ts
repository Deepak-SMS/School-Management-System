import { z } from "zod";
import { BLOOD_GROUPS, EMPLOYEE_TYPES, EMPLOYMENT_STATUSES, GENDERS, STAFF_CATEGORIES } from "@/lib/constants/people";

const optionalString = z
  .string()
  .trim()
  .max(255)
  .optional()
  .transform((v) => (v === "" ? undefined : v));

const phone = z
  .string()
  .trim()
  .refine((v) => /^[0-9+\-\s()]{7,20}$/.test(v), "Invalid phone number");

const optionalPhone = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v))
  .refine((v) => !v || /^[0-9+\-\s()]{7,20}$/.test(v), "Invalid phone number");

export const staffInputSchema = z.object({
  employeeId: z.string().trim().min(1, "Employee ID is required").max(50),
  fullName: z.string().trim().min(1, "Full name is required").max(150),
  photoUrl: optionalString,
  dateOfBirth: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date of birth"),
  gender: z.enum(GENDERS).optional(),
  bloodGroup: z.enum(BLOOD_GROUPS).optional(),
  designation: z.string().trim().min(1, "Designation is required").max(150),
  department: optionalString,
  category: z.enum(STAFF_CATEGORIES),
  mobileNumber: phone,
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  emergencyContact: optionalPhone,
  address: optionalString,
  joiningDate: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid joining date"),
  employeeType: z.enum(EMPLOYEE_TYPES).optional(),
  employmentStatus: z.enum(EMPLOYMENT_STATUSES).default("active"),
});

export type StaffInput = z.infer<typeof staffInputSchema>;
