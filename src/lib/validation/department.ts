import { z } from "zod";
import { DEPARTMENT_TYPES, ACTIVE_STATUSES } from "@/lib/constants/school";

const optionalString = z.string().trim().max(255).optional();

export const departmentInputSchema = z.object({
  name: z.string().trim().min(1, "Department name is required").max(150),
  code: z.string().trim().min(1, "Department code is required").max(30),
  /**
   * No `.default()` here: Zod applies defaults under `.partial()` too, so a
   * default would make every PATCH that omits this field silently reset the
   * department back to "academic". The create route applies DEPARTMENT_DEFAULTS
   * explicitly instead.
   */
  departmentType: z.enum(DEPARTMENT_TYPES).optional(),
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
  status: z.enum(ACTIVE_STATUSES).optional(),
});

export type DepartmentInput = z.infer<typeof departmentInputSchema>;

/** Applied by the create route; deliberately not schema defaults (see above). */
export const DEPARTMENT_DEFAULTS = { departmentType: "academic" as const, status: "active" as const };
