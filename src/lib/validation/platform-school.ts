import { z } from "zod";
import { SCHOOL_PLANS, SCHOOL_STATUSES } from "@/lib/constants/platform";

const optionalString = z.string().trim().max(255).optional();

export const createSchoolSchema = z.object({
  name: z.string().trim().min(1, "School name is required").max(150),
  shortName: z.string().trim().min(1, "Short name is required").max(60),
  address: optionalString,
  city: optionalString,
  state: optionalString,
  country: optionalString,
  pinCode: optionalString,
  phone: optionalString,
  email: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || z.string().email().safeParse(v).success, "Invalid email address"),
  adminName: z.string().trim().min(1, "Admin name is required").max(150),
  adminEmail: z.string().trim().email("Invalid admin email address"),
  plan: z.enum(SCHOOL_PLANS).default("starter"),
});

export type CreateSchoolInput = z.infer<typeof createSchoolSchema>;

export const updateSchoolSchema = z.object({
  name: z.string().trim().min(1, "School name is required").max(150).optional(),
  shortName: z.string().trim().min(1, "Short name is required").max(60).optional(),
  address: optionalString,
  city: optionalString,
  state: optionalString,
  country: optionalString,
  phone: optionalString,
  email: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || z.string().email().safeParse(v).success, "Invalid email address"),
  status: z.enum(SCHOOL_STATUSES).optional(),
  plan: z.enum(SCHOOL_PLANS).optional(),
  enabledModules: z.array(z.string()).nullable().optional(),
});

export type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>;

/** Narrower than updateSchoolSchema — just the fields the "Edit school details" dialog collects. */
export const editSchoolDetailsSchema = z.object({
  name: z.string().trim().min(1, "School name is required").max(150),
  shortName: z.string().trim().min(1, "Short name is required").max(60),
  address: optionalString,
  city: optionalString,
  state: optionalString,
  country: optionalString,
  phone: optionalString,
  email: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || z.string().email().safeParse(v).success, "Invalid email address"),
});

export type EditSchoolDetailsInput = z.infer<typeof editSchoolDetailsSchema>;
