/**
 * Pure recipient-type vocabulary — no Prisma import, so client components
 * (the campaign wizard) and validation schemas can import it directly.
 * Resolution logic (which touches the database) lives in audience.ts.
 */
export const EMAIL_RECIPIENT_TYPE_VALUES = [
  "all_students",
  "selected_students",
  "classes",
  "sections",
  "fee_defaulters",
  "parents",
  "teachers",
  "staff",
  "imported_list",
] as const;
export type EmailRecipientType = (typeof EMAIL_RECIPIENT_TYPE_VALUES)[number];

export const EMAIL_RECIPIENT_TYPES: {
  value: EmailRecipientType;
  label: string;
  description: string;
  needsStudentIds: boolean;
  needsClasses: boolean;
  needsSections: boolean;
  needsMinPending: boolean;
}[] = [
  { value: "fee_defaulters", label: "Students with pending fees", description: "Guardians of every student with an outstanding balance.", needsStudentIds: false, needsClasses: true, needsSections: true, needsMinPending: true },
  { value: "all_students", label: "All students", description: "Guardians of every active student, school-wide.", needsStudentIds: false, needsClasses: false, needsSections: false, needsMinPending: false },
  { value: "classes", label: "Selected classes", description: "Guardians of every active student in the chosen classes.", needsStudentIds: false, needsClasses: true, needsSections: false, needsMinPending: false },
  { value: "sections", label: "Selected sections", description: "Guardians of every active student in the chosen sections.", needsStudentIds: false, needsClasses: false, needsSections: true, needsMinPending: false },
  { value: "selected_students", label: "Selected students", description: "Pick specific students.", needsStudentIds: true, needsClasses: false, needsSections: false, needsMinPending: false },
  { value: "parents", label: "All parents", description: "Every active student's primary guardian.", needsStudentIds: false, needsClasses: false, needsSections: false, needsMinPending: false },
  { value: "teachers", label: "Teachers", description: "Staff holding a subject assignment or a homeroom.", needsStudentIds: false, needsClasses: false, needsSections: false, needsMinPending: false },
  { value: "staff", label: "All staff", description: "Every active staff member with an email on file.", needsStudentIds: false, needsClasses: false, needsSections: false, needsMinPending: false },
  { value: "imported_list", label: "Excel import", description: "Recipients from an uploaded spreadsheet.", needsStudentIds: false, needsClasses: false, needsSections: false, needsMinPending: false },
];
