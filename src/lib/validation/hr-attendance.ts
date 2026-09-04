import { z } from "zod";
import {
  APPLIES_TO,
  HALF_DAY_OPTIONS,
  HOLIDAY_TYPES,
  MARKABLE_ATTENDANCE_STATUSES,
  STAFF_ATTENDANCE_STATUSES,
} from "@/lib/constants/hr-attendance";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const dateString = z
  .string()
  .trim()
  .regex(DATE_RE, "Use the date format YYYY-MM-DD")
  .refine((v) => !Number.isNaN(Date.parse(v)), "That isn't a real date");

const timeString = z
  .string()
  .trim()
  .regex(/^\d{2}:\d{2}$/, "Use the time format HH:MM")
  .optional();

export const holidayInputSchema = z
  .object({
    name: z.string().trim().min(2, "Name the holiday").max(120),
    startDate: dateString,
    /** Omit for a single day. */
    endDate: dateString.optional(),
    holidayType: z.enum(HOLIDAY_TYPES).optional(),
    appliesTo: z.enum(APPLIES_TO).optional(),
    campusId: z.string().trim().optional(),
    isWorkingDay: z.boolean().optional(),
    description: z.string().trim().max(300).optional(),
  })
  .refine((v) => !v.endDate || Date.parse(v.endDate) >= Date.parse(v.startDate), {
    message: "The end date is before the start date",
    path: ["endDate"],
  });

export type HolidayInput = z.infer<typeof holidayInputSchema>;

/** PATCH: its own object, because `.partial()` on a refined schema drops the refinements. */
export const holidayUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  holidayType: z.enum(HOLIDAY_TYPES).optional(),
  appliesTo: z.enum(APPLIES_TO).optional(),
  campusId: z.string().trim().optional(),
  isWorkingDay: z.boolean().optional(),
  description: z.string().trim().max(300).optional(),
});

/** HR marks only the statuses a person can actually be — see the constant's note. */
export const markAttendanceSchema = z.object({
  date: dateString,
  entries: z
    .array(
      z.object({
        staffId: z.string().trim().min(1),
        status: z.enum(MARKABLE_ATTENDANCE_STATUSES as unknown as [string, ...string[]]),
        checkIn: timeString,
        checkOut: timeString,
        remarks: z.string().trim().max(300).optional(),
      }),
    )
    .min(1, "Nothing to mark"),
});

export const periodLockSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  action: z.enum(["lock", "reopen"]),
  /** Required to reopen: closing a month is routine, reopening one is not. */
  reason: z.string().trim().max(300).optional(),
});

export const correctionRequestSchema = z.object({
  staffId: z.string().trim().min(1).optional(),
  date: dateString,
  requestedStatus: z.enum(STAFF_ATTENDANCE_STATUSES as unknown as [string, ...string[]]),
  requestedCheckIn: timeString,
  requestedCheckOut: timeString,
  reason: z.string().trim().min(5, "Say what's wrong with this day").max(500),
});

export const correctionReviewSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(300).optional(),
});

export const leaveTypeInputSchema = z.object({
  name: z.string().trim().min(2, "Name the leave type").max(80),
  code: z
    .string()
    .trim()
    .min(1)
    .max(12)
    .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, hyphen or underscore only"),
  isPaid: z.boolean().optional(),
  annualQuota: z.number().min(0).nullable().optional(),
  carryForward: z.boolean().optional(),
  maxCarryForward: z.number().min(0).nullable().optional(),
  requiresDocument: z.boolean().optional(),
  appliesTo: z.enum(APPLIES_TO).optional(),
  allowHalfDay: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export const leaveRequestInputSchema = z
  .object({
    /** Omitted when an employee applies for themselves. */
    staffId: z.string().trim().optional(),
    leaveTypeId: z.string().trim().min(1, "Choose a leave type"),
    startDate: dateString,
    endDate: dateString,
    halfDay: z.enum(HALF_DAY_OPTIONS).optional(),
    reason: z.string().trim().min(5, "Give a reason").max(500),
    contactDuringLeave: z.string().trim().max(80).optional(),
    documentFileId: z.string().trim().optional(),
  })
  .refine((v) => Date.parse(v.endDate) >= Date.parse(v.startDate), {
    message: "The end date is before the start date",
    path: ["endDate"],
  });

export const leaveDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(500).optional(),
});

export const leaveCancelSchema = z.object({
  reason: z.string().trim().min(5, "Say why this leave is being cancelled").max(300),
});
