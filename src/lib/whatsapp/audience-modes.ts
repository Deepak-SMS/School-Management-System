/**
 * Pure audience-mode vocabulary — no Prisma import, so client components can
 * import the labels directly. Resolution logic (which touches the database)
 * lives in audience.ts. Mirrors src/lib/ai/communication/audience-modes.ts,
 * with phone-based modes (manual_contacts/tag/imported_list) added.
 */
export const WHATSAPP_AUDIENCE_MODE_VALUES = [
  "manual_contacts",
  "tag",
  "class_parents",
  "fee_defaulters",
  "low_attendance_parents",
  "all_guardians",
  "imported_list",
] as const;

export type WhatsAppAudienceMode = (typeof WHATSAPP_AUDIENCE_MODE_VALUES)[number];

export const WHATSAPP_AUDIENCE_MODES: {
  value: WhatsAppAudienceMode;
  label: string;
  description: string;
  needsClassSection: boolean;
  needsThreshold: boolean;
  needsTag: boolean;
  needsContactIds: boolean;
}[] = [
  { value: "class_parents", label: "Parents of a class/section", description: "Guardians of every active student in the selected class or section.", needsClassSection: true, needsThreshold: false, needsTag: false, needsContactIds: false },
  { value: "fee_defaulters", label: "Parents of fee defaulters", description: "Guardians of students with overdue fees.", needsClassSection: true, needsThreshold: false, needsTag: false, needsContactIds: false },
  { value: "low_attendance_parents", label: "Parents of low-attendance students", description: "Guardians of students below the attendance threshold.", needsClassSection: true, needsThreshold: true, needsTag: false, needsContactIds: false },
  { value: "all_guardians", label: "All guardians", description: "Every active student's primary guardian, school-wide.", needsClassSection: false, needsThreshold: false, needsTag: false, needsContactIds: false },
  { value: "manual_contacts", label: "Selected contacts", description: "Pick specific contacts from the address book.", needsClassSection: false, needsThreshold: false, needsTag: false, needsContactIds: true },
  { value: "tag", label: "Contacts by tag", description: "Every contact carrying a chosen tag.", needsClassSection: false, needsThreshold: false, needsTag: true, needsContactIds: false },
  { value: "imported_list", label: "Most recent Excel import", description: "Every active contact whose source is an Excel import.", needsClassSection: false, needsThreshold: false, needsTag: false, needsContactIds: false },
];
