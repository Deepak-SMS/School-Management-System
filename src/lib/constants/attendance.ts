import { ATTENDANCE_STATUSES } from "@/lib/validation/attendance";

export { ATTENDANCE_STATUSES };

export const ATTENDANCE_STATUS_LABELS: Record<(typeof ATTENDANCE_STATUSES)[number], string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  half_day: "Half day",
  leave: "Leave",
};

export const ATTENDANCE_STATUS_BADGE: Record<
  (typeof ATTENDANCE_STATUSES)[number],
  "success" | "danger" | "warning" | "neutral"
> = {
  present: "success",
  absent: "danger",
  late: "warning",
  half_day: "warning",
  leave: "neutral",
};

/** Which statuses count toward an attendance percentage as "present" vs "absent" — the one classification every percentage calculation in the app must agree on (dashboard, student profile, reports). */
export const PRESENT_STATUSES: (typeof ATTENDANCE_STATUSES)[number][] = ["present", "late", "half_day"];
export const ABSENT_STATUSES: (typeof ATTENDANCE_STATUSES)[number][] = ["absent", "leave"];
