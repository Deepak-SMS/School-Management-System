/**
 * Pure audience-mode vocabulary — no Prisma import, so client components can
 * import the labels directly. The actual resolution logic (which touches the
 * database) lives in audience.ts, which imports the type from here.
 */
export const AUDIENCE_MODE_VALUES = ["custom", "fee_defaulters", "low_attendance_parents", "class_parents", "all_staff"] as const;
export type AudienceMode = (typeof AUDIENCE_MODE_VALUES)[number];

export const AUDIENCE_MODES: { value: AudienceMode; label: string; description: string; needsClassSection: boolean; needsThreshold: boolean }[] = [
  { value: "custom", label: "Custom / describe in context", description: "No real recipient list — posts as a school-wide notification when sent.", needsClassSection: false, needsThreshold: false },
  { value: "class_parents", label: "Parents of a class/section", description: "Real guardian list for the selected class or section.", needsClassSection: true, needsThreshold: false },
  { value: "low_attendance_parents", label: "Parents of low-attendance students", description: "Real list of students below the attendance threshold.", needsClassSection: true, needsThreshold: true },
  { value: "fee_defaulters", label: "Parents of fee defaulters", description: "Real list of students with overdue fees.", needsClassSection: true, needsThreshold: false },
  { value: "all_staff", label: "All active staff", description: "Every active staff member with an email on file.", needsClassSection: false, needsThreshold: false },
];
