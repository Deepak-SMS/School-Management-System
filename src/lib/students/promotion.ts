import type { ClassMappingInput, StudentOverrideInput, PromotionAction } from "@/lib/validation/promotion";

export interface PromotableClass {
  id: string;
  sortOrder: number;
  campusId: string;
}

/**
 * The default target class for a source class: same campus, the next grade up
 * (smallest `sortOrder` in the target year strictly greater than the source
 * class's own). `sortOrder` is how classes are seeded/ordered — see
 * prisma/seed.ts — so this reads as "the next class in the same campus's
 * ladder." No match (e.g. the source class is the school's terminal grade)
 * means there is nothing to promote into.
 */
export function suggestTargetClass(source: PromotableClass, targetYearClasses: PromotableClass[]): PromotableClass | null {
  const candidates = targetYearClasses
    .filter((c) => c.campusId === source.campusId && c.sortOrder > source.sortOrder)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return candidates[0] ?? null;
}

/** A class row has nowhere to promote into — the sensible default is to graduate/exit its students, not silently retain them. */
export function suggestActionFor(target: PromotableClass | null): PromotionAction {
  return target ? "promote" : "exit";
}

/**
 * The "retain" target: the same grade in the target year (same campus, same
 * `sortOrder`) — a retained student repeats their current grade next year, so
 * they need *that* year's copy of their current class, not their old class's
 * (now stale, previous-year) id.
 */
export function suggestSameLevelClass(source: PromotableClass, targetYearClasses: PromotableClass[]): PromotableClass | null {
  return targetYearClasses.find((c) => c.campusId === source.campusId && c.sortOrder === source.sortOrder) ?? null;
}

export interface ResolvedOutcome {
  action: PromotionAction;
  targetClassId?: string;
  targetSectionId?: string;
}

/**
 * The outcome for one student: their class's bulk mapping, unless a
 * per-student override names them explicitly — the mechanism for the common
 * exception (one repeater in an otherwise-promoted class).
 */
export function resolveStudentOutcome(
  studentId: string,
  classMapping: ClassMappingInput,
  overrides: StudentOverrideInput[],
): ResolvedOutcome {
  const override = overrides.find((o) => o.studentId === studentId);
  if (override) {
    return { action: override.action, targetClassId: override.targetClassId, targetSectionId: override.targetSectionId };
  }
  return { action: classMapping.action, targetClassId: classMapping.targetClassId, targetSectionId: classMapping.targetSectionId };
}
