import { z } from "zod";
import { EXAM_RESULT_TYPES, EXAM_STATUSES } from "@/lib/constants/exam";

const optionalDate = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid date");

/** One applicable class, optionally narrowed to a single section — same shape as News's audienceTargetSchema. */
export const examClassTargetSchema = z.object({
  classId: z.string().min(1),
  sectionId: z.string().trim().optional(),
});

/**
 * Base object (no refinements, no `classes`) — used directly as the client
 * form's resolver schema, since "applicable classes" is tracked as separate
 * component state (same reasoning class-form.tsx keeps `sectionNames`
 * outside the zod schema). `.partial()` cannot be applied to a refined
 * (ZodEffects) schema, so PATCH builds from this too.
 */
export const examCoreSchema = z.object({
  name: z.string().trim().min(1, "Exam name is required").max(150),
  code: z.string().trim().min(1, "Exam code is required").max(30),
  academicYearId: z.string().min(1, "Academic year is required"),
  examTypeId: z.string().min(1, "Exam type is required"),
  term: z.string().trim().max(100).optional(),
  startDate: z
    .string()
    .trim()
    .min(1, "Start date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  endDate: z
    .string()
    .trim()
    .min(1, "End date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
  resultDate: optionalDate,
  resultType: z.enum(EXAM_RESULT_TYPES).default("marks"),
  status: z.enum(EXAM_STATUSES).default("draft"),
});

export type ExamCoreInput = z.infer<typeof examCoreSchema>;

/** Server-side create schema: the core fields plus the applicable classes/sections, date-ordered. */
export const examInputSchema = examCoreSchema
  .extend({ classes: z.array(examClassTargetSchema).min(1, "Select at least one class") })
  .refine((data) => Date.parse(data.endDate) >= Date.parse(data.startDate), {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  });

export type ExamInput = z.infer<typeof examInputSchema>;

/** Server-side update schema — every field optional, no cross-field refinement (a partial edit may legitimately touch only one date). */
export const examPatchSchema = examCoreSchema.extend({ classes: z.array(examClassTargetSchema) }).partial();

export type ExamPatchInput = z.infer<typeof examPatchSchema>;
