"use client";

import { useEffect, useState } from "react";
import { ATTENDANCE_STATUSES } from "@/lib/constants/attendance";

interface AttendanceSettingsFlags {
  allowHalfDay: boolean;
  allowLate: boolean;
  allowLeave: boolean;
}

/**
 * Present and Absent are always on; Half day/Late/Leave can each be turned
 * off in Attendance settings. Used everywhere a status appears — the marking
 * screen, the calendar legend, and report columns — so a disabled status
 * disappears consistently everywhere, not just where it's marked.
 */
export function useAllowedStatuses(): (typeof ATTENDANCE_STATUSES)[number][] {
  const [allowed, setAllowed] = useState<(typeof ATTENDANCE_STATUSES)[number][]>([...ATTENDANCE_STATUSES]);

  useEffect(() => {
    fetch("/api/attendance/settings")
      .then((r) => r.json())
      .then((settings: AttendanceSettingsFlags) => {
        setAllowed(
          ATTENDANCE_STATUSES.filter((status) => {
            if (status === "half_day") return settings.allowHalfDay;
            if (status === "late") return settings.allowLate;
            if (status === "leave") return settings.allowLeave;
            return true;
          }),
        );
      })
      .catch(() => undefined);
  }, []);

  return allowed;
}
