import { z } from "zod";

/** What happens to every student in a source class, unless a per-student override says otherwise. */
export const PROMOTION_ACTIONS = ["promote", "retain", "exit"] as const;
export type PromotionAction = (typeof PROMOTION_ACTIONS)[number];

export const classMappingSchema = z.object({
  sourceClassId: z.string().min(1),
  action: z.enum(PROMOTION_ACTIONS),
  /** Required when action is "promote" — which class in the target year they move into. */
  targetClassId: z.string().min(1).optional(),
  /** Optional even when promoting — an unset section means "unassigned in the new class", corrected later. */
  targetSectionId: z.string().min(1).optional(),
});

export const studentOverrideSchema = z.object({
  studentId: z.string().min(1),
  action: z.enum(PROMOTION_ACTIONS),
  targetClassId: z.string().min(1).optional(),
  targetSectionId: z.string().min(1).optional(),
});

export const promotionCommitSchema = z.object({
  sourceAcademicYearId: z.string().min(1),
  targetAcademicYearId: z.string().min(1),
  classMappings: z.array(classMappingSchema).min(1, "Nothing to promote"),
  studentOverrides: z.array(studentOverrideSchema).default([]),
});

export type ClassMappingInput = z.infer<typeof classMappingSchema>;
export type StudentOverrideInput = z.infer<typeof studentOverrideSchema>;
export type PromotionCommitInput = z.infer<typeof promotionCommitSchema>;
