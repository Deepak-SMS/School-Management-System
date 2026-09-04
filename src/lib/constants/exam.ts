/**
 * Single source of truth for every "enum-like" string field across the Exam
 * module. SQLite has no native enum type (see prisma/schema.prisma), so these
 * arrays back both the Zod validation schemas and the UI <Select> options —
 * same convention as src/lib/constants/school.ts.
 */

export const EXAM_CATEGORIES = ["summative", "formative"] as const;

export const EXAM_CATEGORY_LABELS: Record<(typeof EXAM_CATEGORIES)[number], string> = {
  summative: "Summative",
  formative: "Formative",
};

export const EXAM_STATUSES = ["draft", "scheduled", "ongoing", "completed", "results_pending", "published", "archived"] as const;

export const EXAM_STATUS_LABELS: Record<(typeof EXAM_STATUSES)[number], string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  ongoing: "Ongoing",
  completed: "Completed",
  results_pending: "Results Pending",
  published: "Published",
  archived: "Archived",
};

/** Shown in the "Know more" panel on the Exams list — set manually today via the exam's own Status field, updated as the exam moves through its lifecycle. */
export const EXAM_STATUS_DESCRIPTIONS: Record<(typeof EXAM_STATUSES)[number], string> = {
  draft: "Still being set up — dates, classes, and subjects can be freely changed. Not yet visible to teachers.",
  scheduled: "The plan is finalized and dates are locked in. Teachers and classes can see it's coming up.",
  ongoing: "Currently being conducted, within its exam date range.",
  completed: "All papers have been conducted. Marks entry can begin.",
  results_pending: "Marks are being entered and verified — results aren't finalized yet.",
  published: "Results are finalized and released to students and parents.",
  archived: "Closed out and kept for historical record. No further changes expected.",
};

export const EXAM_RESULT_TYPES = ["marks", "grades", "marks_and_grades"] as const;

export const EXAM_RESULT_TYPE_LABELS: Record<(typeof EXAM_RESULT_TYPES)[number], string> = {
  marks: "Marks only",
  grades: "Grades only",
  marks_and_grades: "Marks + Grades",
};
