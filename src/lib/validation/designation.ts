import { z } from "zod";

/**
 * Designations are per-school (spec §2.12) — "PGT Physics" in one school and
 * "Senior Teacher" in another. `level` orders the ladder for reporting and
 * appraisal; it grants no authority, which always comes from Role.
 */
export const designationInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, hyphen or underscore only")
    .transform((v) => v.toUpperCase()),
  departmentId: z.string().trim().optional(),
  // Left optional rather than defaulted: Zod applies defaults under `.partial()`
  // too, so a default would reset level/status on any PATCH that omits them.
  // The create route supplies the defaults explicitly.
  level: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().min(0).max(100).optional(),
  ),
  description: z.string().trim().max(500).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export type DesignationInput = z.infer<typeof designationInputSchema>;

export const DESIGNATION_DEFAULTS = { level: 0, status: "active" as const };

/** Derives a code from a name for the find-or-create path used by CSV import. */
export function codeFromName(name: string): string {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 20) || "ROLE";
}
