import { z } from "zod";
import { DEPARTMENT_TYPES, ACTIVE_STATUSES } from "@/lib/constants/school";

const optionalString = z.string().trim().max(255).optional();

export const departmentInputSchema = z.object({
  name: z.string().trim().min(1, "Department name is required").max(150),
  code: z.string().trim().min(1, "Department code is required").max(30),
  departmentType: z.enum(DEPARTMENT_TYPES).default("academic"),
  headStaffId: optionalString,
  description: optionalString,
  campusId: optionalString,
  email: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || z.string().email().safeParse(v).success, "Invalid email address"),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^[0-9+\-\s()]{7,20}$/.test(v), "Invalid phone number"),
  status: z.enum(ACTIVE_STATUSES).default("active"),
});

export type DepartmentInput = z.infer<typeof departmentInputSchema>;
