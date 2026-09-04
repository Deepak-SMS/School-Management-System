import { z } from "zod";

const percent = z.coerce.number().min(0).max(100);

export const attendanceSettingsInputSchema = z.object({
  mode: z.enum(["daily", "period", "both"]).optional(),
  warningThreshold: percent.optional(),
  criticalThreshold: percent.optional(),
  allowHalfDay: z.boolean().optional(),
  allowLate: z.boolean().optional(),
  allowLeave: z.boolean().optional(),
});

export type AttendanceSettingsInput = z.infer<typeof attendanceSettingsInputSchema>;

export const ATTENDANCE_SETTINGS_DEFAULTS = {
  mode: "both" as const,
  warningThreshold: 90,
  criticalThreshold: 75,
  allowHalfDay: true,
  allowLate: true,
  allowLeave: true,
};
