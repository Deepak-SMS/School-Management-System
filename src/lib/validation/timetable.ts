import { z } from "zod";
import { WEEKDAYS } from "@/lib/constants/school";
import { ROOM_TYPES, PERIOD_KINDS, TIMETABLE_STATUSES } from "@/lib/constants/timetable";
import { optionalNumber } from "@/lib/validation/shared";

const optionalString = z.string().trim().max(255).optional();

export const roomInputSchema = z.object({
  name: z.string().trim().min(1, "Room name is required").max(100),
  campusId: optionalString,
  buildingName: optionalString,
  floor: optionalString,
  capacity: optionalNumber(z.coerce.number().int().positive()),
  roomType: z.enum(ROOM_TYPES).default("classroom"),
  /** Subject ids this room is restricted to; empty/omitted = any subject. */
  allowedSubjectIds: z.array(z.string()).optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

export type RoomInput = z.infer<typeof roomInputSchema>;

const periodRowSchema = z.object({
  sortOrder: z.coerce.number().int().min(0),
  label: z.string().trim().min(1, "Label is required").max(60),
  startTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM"),
  endTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM"),
  kind: z.enum(PERIOD_KINDS).default("teaching"),
});

export const timingSetInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  periods: z.array(periodRowSchema).min(1, "Add at least one period"),
});

export type TimingSetInput = z.infer<typeof timingSetInputSchema>;

export const timetableClassSchema = z.object({
  classId: z.string().min(1),
  sectionId: z.string().trim().optional(),
});

export const timetableInputSchema = z.object({
  academicYearId: z.string().min(1, "Academic year is required"),
  name: z.string().trim().min(1, "Name is required").max(150),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  timingSetId: z.string().min(1, "Timing set is required"),
  workingDays: z.array(z.enum(WEEKDAYS)).min(1, "Select at least one working day"),
  classes: z.array(timetableClassSchema).min(1, "Select at least one class"),
});

export type TimetableInput = z.infer<typeof timetableInputSchema>;

export const timetableUpdateSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  status: z.enum(TIMETABLE_STATUSES).optional(),
  classes: z.array(timetableClassSchema).optional(),
});

export type TimetableUpdateInput = z.infer<typeof timetableUpdateSchema>;

/** PATCH on an existing SubjectAssignment — the generator's workload input. */
export const subjectAssignmentScheduleSchema = z.object({
  periodsPerWeek: z.coerce.number().int().min(0).max(60),
  preferDoublePeriod: z.boolean().default(false),
  preferredRoomId: z.string().trim().optional(),
});

export type SubjectAssignmentScheduleInput = z.infer<typeof subjectAssignmentScheduleSchema>;

export const teacherAvailabilityInputSchema = z.object({
  maxPeriodsPerDay: optionalNumber(z.coerce.number().int().positive()),
  maxConsecutivePeriods: optionalNumber(z.coerce.number().int().positive()),
  /** Full replacement list of blackouts — `periodId: null` means unavailable the whole day. */
  unavailability: z.array(
    z.object({
      dayOfWeek: z.enum(WEEKDAYS),
      periodId: z.string().nullable(),
    }),
  ),
});

export type TeacherAvailabilityInput = z.infer<typeof teacherAvailabilityInputSchema>;

/** Manual create/move of one timetable slot. */
export const timetableSlotInputSchema = z.object({
  sectionId: z.string().min(1),
  dayOfWeek: z.enum(WEEKDAYS),
  periodId: z.string().min(1),
  subjectId: z.string().min(1),
  teacherId: z.string().trim().optional(),
  roomId: z.string().trim().optional(),
});

export type TimetableSlotInput = z.infer<typeof timetableSlotInputSchema>;
