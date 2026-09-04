/**
 * Single source of truth for every "enum-like" string field on the Library
 * models. SQLite has no native enum type (see prisma/schema.prisma), so these
 * arrays back both the Zod validation schemas and the UI <Select> options.
 */

export const LIBRARY_COPY_STATUSES = [
  "available",
  "issued",
  "reserved",
  "lost",
  "damaged",
  "under_maintenance",
  "removed",
] as const;

export type LibraryCopyStatus = (typeof LIBRARY_COPY_STATUSES)[number];

export const LIBRARY_COPY_STATUS_LABELS: Record<(typeof LIBRARY_COPY_STATUSES)[number], string> = {
  available: "Available",
  issued: "Issued",
  reserved: "Reserved",
  lost: "Lost",
  damaged: "Damaged",
  under_maintenance: "Under Maintenance",
  removed: "Removed",
};

export const LIBRARY_COPY_CONDITIONS = ["excellent", "good", "fair", "damaged", "severely_damaged"] as const;

export type LibraryCopyCondition = (typeof LIBRARY_COPY_CONDITIONS)[number];

export const LIBRARY_COPY_CONDITION_LABELS: Record<(typeof LIBRARY_COPY_CONDITIONS)[number], string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  damaged: "Damaged",
  severely_damaged: "Severely Damaged",
};

/** Seeded into every school's LibraryCategory table on first visit to Library Settings. */
export const DEFAULT_LIBRARY_CATEGORIES = [
  "Academic",
  "Mathematics",
  "Science",
  "English",
  "Hindi",
  "Social Science",
  "Literature",
  "Fiction",
  "Non-fiction",
  "Poetry",
  "Drama",
  "Reference",
  "Dictionary",
  "Encyclopedia",
  "Atlas",
  "General",
  "History",
  "Geography",
  "Technology",
  "Biography",
  "Art",
  "Sports",
] as const;
