import { z } from "zod";
import { optionalNumber } from "@/lib/validation/shared";

const optionalString = z.string().trim().max(500).optional();

/** Fee heads (Tuition, Admission, Transport...) are a per-school master, not a hardcoded list — every school names and organizes these differently. */
export const feeCategoryInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, hyphen or underscore only")
    .transform((v) => v.toUpperCase()),
  description: optionalString,
  // Optional rather than defaulted: Zod applies defaults under `.partial()` too,
  // which would silently reset these on any PATCH that omits them.
  isRefundable: z.boolean().optional(),
  sortOrder: optionalNumber(z.coerce.number().int().min(0).max(999)),
  status: z.enum(["active", "inactive"]).optional(),
});

export type FeeCategoryInput = z.infer<typeof feeCategoryInputSchema>;

export const FEE_CATEGORY_DEFAULTS = { isRefundable: false, sortOrder: 0, status: "active" as const };
