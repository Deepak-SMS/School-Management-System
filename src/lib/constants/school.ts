/**
 * Single source of truth for every "enum-like" string field across the School
 * Management modules (Campus, Academic Year, Class, Section, Subject,
 * Department, School profile). SQLite has no native enum type (see
 * prisma/schema.prisma), so these arrays back both the Zod validation
 * schemas and the UI <Select> options.
 */

export const SCHOOL_TYPES = ["public", "private", "government", "government_aided", "international", "other"] as const;

export const SCHOOL_TYPE_LABELS: Record<(typeof SCHOOL_TYPES)[number], string> = {
  public: "Public",
  private: "Private",
  government: "Government",
  government_aided: "Government Aided",
  international: "International",
  other: "Other",
};

export const INSTITUTION_TYPES = ["school", "college", "university", "training_institute"] as const;

export const INSTITUTION_TYPE_LABELS: Record<(typeof INSTITUTION_TYPES)[number], string> = {
  school: "School",
  college: "College",
  university: "University",
  training_institute: "Training Institute",
};

export const CAMPUS_TYPES = ["main", "junior", "senior", "college", "hostel", "other"] as const;

export const CAMPUS_TYPE_LABELS: Record<(typeof CAMPUS_TYPES)[number], string> = {
  main: "Main Campus",
  junior: "Junior Campus",
  senior: "Senior Campus",
  college: "College Campus",
  hostel: "Hostel Campus",
  other: "Other",
};

export const ACTIVE_STATUSES = ["active", "inactive"] as const;

export const ACADEMIC_YEAR_STATUSES = ["draft", "active", "upcoming", "archived"] as const;

export const SUBJECT_TYPES = ["core", "elective", "optional", "co_curricular", "practical", "language"] as const;

export const SUBJECT_TYPE_LABELS: Record<(typeof SUBJECT_TYPES)[number], string> = {
  core: "Core",
  elective: "Elective",
  optional: "Optional",
  co_curricular: "Co-curricular",
  practical: "Practical",
  language: "Language",
};

export const SUBJECT_NATURE_TYPES = ["theory", "practical"] as const;

export const DEPARTMENT_TYPES = [
  "academic",
  "administration",
  "finance",
  "hr",
  "operations",
  "support",
  "transport",
  "library",
  "it",
  "other",
] as const;

export const DEPARTMENT_TYPE_LABELS: Record<(typeof DEPARTMENT_TYPES)[number], string> = {
  academic: "Academic",
  administration: "Administration",
  finance: "Finance",
  hr: "HR",
  operations: "Operations",
  support: "Support",
  transport: "Transport",
  library: "Library",
  it: "IT",
  other: "Other",
};

export const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

export const WEEKDAY_LABELS: Record<(typeof WEEKDAYS)[number], string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export const GRADING_SYSTEMS = ["Percentage", "GPA", "CGPA", "Letter Grade"] as const;

export const TIME_ZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC",
] as const;

export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "AUD", "CAD"] as const;

export const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] as const;

export const LANGUAGES = ["English", "Hindi", "Arabic", "French", "Spanish"] as const;
