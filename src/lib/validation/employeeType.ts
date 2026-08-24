import { z } from "zod";

/**
 * Employee types are a per-school master table, not a constant — spec §2.13
 * requires schools to add their own (Visiting Faculty, Consultant, ...).
 */
export const employeeTypeInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, hyphen or underscore only")
    .transform((v) => v.toUpperCase()),
  // All optional rather than defaulted: Zod applies defaults under `.partial()`
  // as well, so defaults here would silently reset these on any PATCH that omits
  // them. The create route supplies the defaults explicitly.
  /** Unpaid types (e.g. Intern) let payroll skip them without matching on names. */
  isPaid: z.boolean().optional(),
  sortOrder: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().min(0).max(999).optional(),
  ),
  status: z.enum(["active", "inactive"]).optional(),
});

export type EmployeeTypeInput = z.infer<typeof employeeTypeInputSchema>;

export const EMPLOYEE_TYPE_DEFAULTS = { isPaid: true, sortOrder: 0, status: "active" as const };
