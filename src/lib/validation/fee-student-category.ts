import { z } from "zod";
import { optionalNumber } from "@/lib/validation/shared";

const optionalString = z.string().trim().max(500).optional();

/** Fee-purpose student groupings (General, RTE, Staff Ward, Sibling...) — see FeeStudentCategory in schema.prisma for why this is separate from Student.category. */
export const feeStudentCategoryInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, hyphen or underscore only")
    .transform((v) => v.toUpperCase()),
  description: optionalString,
  sortOrder: optionalNumber(z.coerce.number().int().min(0).max(999)),
  status: z.enum(["active", "inactive"]).optional(),
});

export type FeeStudentCategoryInput = z.infer<typeof feeStudentCategoryInputSchema>;

export const FEE_STUDENT_CATEGORY_DEFAULTS = { sortOrder: 0, status: "active" as const };
