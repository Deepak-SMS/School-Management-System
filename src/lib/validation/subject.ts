import { z } from "zod";
import { SUBJECT_TYPES, SUBJECT_NATURE_TYPES, ACTIVE_STATUSES, GRADING_SYSTEMS } from "@/lib/constants/school";
import { optionalNumber } from "@/lib/validation/shared";

const optionalString = z.string().trim().max(500).optional();

/** Base object (no refinements) — `.partial()` cannot be applied to a refined (ZodEffects) schema, so PATCH routes build their schema from this instead of subjectInputSchema. */
export const subjectBaseSchema = z.object({
  name: z.string().trim().min(1, "Subject name is required").max(150),
  code: z.string().trim().min(1, "Subject code is required").max(30),
  subjectType: z.enum(SUBJECT_TYPES).default("core"),
  description: optionalString,
  natureType: z.enum(SUBJECT_NATURE_TYPES).default("theory"),
  maxMarks: optionalNumber(z.coerce.number().int().positive()),
  passingMarks: optionalNumber(z.coerce.number().int().min(0)),
  credits: optionalNumber(z.coerce.number().positive()),
  gradingSystem: z.enum(GRADING_SYSTEMS).optional(),
  status: z.enum(ACTIVE_STATUSES).default("active"),
});

function passingBelowMax(data: { maxMarks?: number; passingMarks?: number }) {
  return data.maxMarks === undefined || data.passingMarks === undefined || data.passingMarks < data.maxMarks;
}

export const subjectInputSchema = subjectBaseSchema.refine(passingBelowMax, {
  message: "Passing marks must be less than maximum marks",
  path: ["passingMarks"],
});

/** For PATCH: marks are only compared against each other when both are present in the same request. */
export const subjectUpdateSchema = subjectBaseSchema.partial().refine(passingBelowMax, {
  message: "Passing marks must be less than maximum marks",
  path: ["passingMarks"],
});

export type SubjectInput = z.infer<typeof subjectInputSchema>;

export const subjectAssignmentInputSchema = z.object({
  academicYearId: z.string().min(1, "Academic year is required"),
  classId: z.string().min(1, "Class is required"),
  sectionId: z.string().trim().optional(),
  teacherId: z.string().trim().optional(),
});

export type SubjectAssignmentInput = z.infer<typeof subjectAssignmentInputSchema>;
