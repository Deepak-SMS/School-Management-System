import { z } from "zod";
import { CAMPUS_TYPES, ACTIVE_STATUSES } from "@/lib/constants/school";
import { optionalNumber } from "@/lib/validation/shared";

const optionalString = z.string().trim().max(255).optional();

const optionalPhone = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || /^[0-9+\-\s()]{7,20}$/.test(v), "Invalid phone number");

export const campusInputSchema = z.object({
  name: z.string().trim().min(1, "Campus name is required").max(150),
  code: z.string().trim().min(1, "Campus code is required").max(30),
  campusType: z.enum(CAMPUS_TYPES).default("main"),
  headStaffId: optionalString,
  address: optionalString,
  city: optionalString,
  state: optionalString,
  country: optionalString,
  pinCode: optionalString,
  phone: optionalPhone,
  email: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || z.string().email().safeParse(v).success, "Invalid email address"),
  website: optionalString,
  studentCapacity: optionalNumber(z.coerce.number().int().positive()),
  staffCapacity: optionalNumber(z.coerce.number().int().positive()),
  status: z.enum(ACTIVE_STATUSES).default("active"),
});

export type CampusInput = z.infer<typeof campusInputSchema>;
