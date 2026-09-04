import { z } from "zod";

const positiveInt = z.coerce.number().int().min(0).max(365);

export const librarySettingsInputSchema = z.object({
  studentMaxBooks: positiveInt.optional(),
  studentIssueDays: positiveInt.optional(),
  teacherMaxBooks: positiveInt.optional(),
  teacherIssueDays: positiveInt.optional(),
  staffMaxBooks: positiveInt.optional(),
  staffIssueDays: positiveInt.optional(),
  maxRenewals: z.coerce.number().int().min(0).max(20).optional(),
  finePerDay: z.coerce.number().min(0).max(10000).optional(),
  maxFine: z.coerce.number().min(0).max(100000).optional(),
  reminderDaysBefore: z.coerce.number().int().min(0).max(30).optional(),
});

export type LibrarySettingsInput = z.infer<typeof librarySettingsInputSchema>;

export const LIBRARY_SETTINGS_DEFAULTS = {
  studentMaxBooks: 2,
  studentIssueDays: 14,
  teacherMaxBooks: 5,
  teacherIssueDays: 30,
  staffMaxBooks: 3,
  staffIssueDays: 21,
  maxRenewals: 2,
  finePerDay: 5,
  maxFine: 500,
  reminderDaysBefore: 2,
};
