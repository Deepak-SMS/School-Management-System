import { z } from "zod";

export const ATTENDANCE_STATUSES = ["present", "absent", "late", "half_day", "leave"] as const;

export const markAttendanceInputSchema = z.object({
  classId: z.string().min(1),
  sectionId: z.string().min(1),
  /** Omit for daily/homeroom attendance; set for a specific subject's period. */
  subjectId: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  records: z
    .array(
      z.object({
        studentId: z.string().min(1),
        status: z.enum(ATTENDANCE_STATUSES),
        remarks: z.string().trim().max(255).optional(),
      }),
    )
    .min(1, "Mark at least one student"),
});

export type MarkAttendanceInput = z.infer<typeof markAttendanceInputSchema>;
