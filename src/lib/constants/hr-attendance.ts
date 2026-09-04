/**
 * Enum-like string fields for staff attendance, the work calendar, and leave.
 * SQLite has no native enum type (see prisma/schema.prisma), so these arrays
 * back both the Zod schemas and the UI <Select> options.
 */

export const STAFF_ATTENDANCE_STATUSES = [
  "present",
  "absent",
  "half_day",
  "late",
  "early_leaving",
  "on_duty",
  "wfh",
  "holiday",
  "weekly_off",
  "paid_leave",
  "unpaid_leave",
] as const;

export type StaffAttendanceStatus = (typeof STAFF_ATTENDANCE_STATUSES)[number];

export const STAFF_ATTENDANCE_LABELS: Record<StaffAttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  half_day: "Half day",
  late: "Late",
  early_leaving: "Early leaving",
  on_duty: "On duty",
  wfh: "Work from home",
  holiday: "Holiday",
  weekly_off: "Weekly off",
  paid_leave: "Paid leave",
  unpaid_leave: "Unpaid leave",
};

export const STAFF_ATTENDANCE_TONES: Record<StaffAttendanceStatus, "neutral" | "success" | "warning" | "danger"> = {
  present: "success",
  absent: "danger",
  half_day: "warning",
  late: "warning",
  early_leaving: "warning",
  on_duty: "success",
  wfh: "success",
  holiday: "neutral",
  weekly_off: "neutral",
  paid_leave: "neutral",
  unpaid_leave: "danger",
};

/**
 * What HR may set by hand. Holiday and weekly-off come from the calendar, and
 * the two leave statuses come from an approved leave request — typing those in
 * directly would let attendance disagree with the records behind them.
 */
export const MARKABLE_ATTENDANCE_STATUSES: StaffAttendanceStatus[] = [
  "present",
  "absent",
  "half_day",
  "late",
  "early_leaving",
  "on_duty",
  "wfh",
];

/** Statuses the employee is considered to have worked, for the payroll count. */
export const PAID_PRESENT_STATUSES: StaffAttendanceStatus[] = ["present", "late", "early_leaving", "on_duty", "wfh"];

/** Counts as half a day worked. */
export const HALF_DAY_STATUSES: StaffAttendanceStatus[] = ["half_day"];

/** Days the school is closed — not working days, and never absences. */
export const NON_WORKING_STATUSES: StaffAttendanceStatus[] = ["holiday", "weekly_off"];

export const HOLIDAY_TYPES = ["public", "school", "staff", "optional", "vacation"] as const;

export const HOLIDAY_TYPE_LABELS: Record<(typeof HOLIDAY_TYPES)[number], string> = {
  public: "Public holiday",
  school: "School holiday",
  staff: "Staff holiday",
  optional: "Optional holiday",
  vacation: "Vacation",
};

export const APPLIES_TO = ["all", "teaching", "non_teaching"] as const;

export const APPLIES_TO_LABELS: Record<(typeof APPLIES_TO)[number], string> = {
  all: "All employees",
  teaching: "Teaching staff",
  non_teaching: "Non-teaching staff",
};

export const LEAVE_REQUEST_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;

export type LeaveRequestStatus = (typeof LEAVE_REQUEST_STATUSES)[number];

export const LEAVE_REQUEST_STATUS_LABELS: Record<LeaveRequestStatus, string> = {
  pending: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export const LEAVE_REQUEST_TONES: Record<LeaveRequestStatus, "neutral" | "success" | "warning" | "danger"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "neutral",
};

export const HALF_DAY_OPTIONS = ["none", "first_half", "second_half"] as const;

export const HALF_DAY_LABELS: Record<(typeof HALF_DAY_OPTIONS)[number], string> = {
  none: "Full day",
  first_half: "First half",
  second_half: "Second half",
};

export const CORRECTION_STATUSES = ["pending", "approved", "rejected"] as const;

/** The leave types most Indian schools run. Seeded so the module works on day one. */
export const DEFAULT_LEAVE_TYPES = [
  { name: "Casual Leave", code: "CL", isPaid: true, annualQuota: 12, carryForward: false },
  { name: "Sick Leave", code: "SL", isPaid: true, annualQuota: 12, carryForward: false, requiresDocument: true },
  { name: "Earned Leave", code: "EL", isPaid: true, annualQuota: 15, carryForward: true, maxCarryForward: 30 },
  { name: "Medical Leave", code: "ML", isPaid: true, annualQuota: 10, carryForward: false, requiresDocument: true },
  { name: "Maternity Leave", code: "MTL", isPaid: true, annualQuota: 182, carryForward: false },
  { name: "Paternity Leave", code: "PTL", isPaid: true, annualQuota: 15, carryForward: false },
  { name: "Compensatory Leave", code: "COMP", isPaid: true, annualQuota: null, carryForward: false },
  { name: "Special Leave", code: "SPL", isPaid: true, annualQuota: 5, carryForward: false },
  { name: "Unpaid Leave", code: "LWP", isPaid: false, annualQuota: null, carryForward: false },
] as const;
