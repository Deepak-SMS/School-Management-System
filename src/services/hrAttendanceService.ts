import type { ApiError } from "@/services/studentService";

export interface HolidayRecord {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  holidayType: string;
  appliesTo: string;
  isWorkingDay: boolean;
  description?: string | null;
  campus?: { id: string; name: string } | null;
}

export interface DaySheetRow {
  staffId: string;
  employeeId: string;
  fullName: string;
  department: string | null;
  isWorkingDay: boolean;
  nonWorkingReason: string | null;
  attendance: {
    id: string;
    status: string;
    checkIn?: string | null;
    checkOut?: string | null;
    remarks?: string | null;
    source: string;
  } | null;
}

export interface DaySheet {
  date: string;
  locked: boolean;
  lockedAt: string | null;
  data: DaySheetRow[];
  total: number;
}

export interface AttendanceSummaryRow {
  staffId: string;
  employeeId: string;
  fullName: string;
  department: string | null;
  workingDays: number;
  present: number;
  halfDays: number;
  paidLeave: number;
  unpaidLeave: number;
  absent: number;
  unmarked: number;
  lateCount: number;
  payableDays: number;
}

export interface AttendanceSummary {
  year: number;
  month: number;
  from: string;
  to: string;
  locked: boolean;
  lockedAt: string | null;
  reopenedAt: string | null;
  reopenReason: string | null;
  readyForPayroll: boolean;
  totals: { employees: number; present: number; paidLeave: number; unpaidLeave: number; absent: number; unmarked: number };
  data: AttendanceSummaryRow[];
}

export interface LeaveTypeRecord {
  id: string;
  name: string;
  code: string;
  isPaid: boolean;
  annualQuota: number | null;
  carryForward: boolean;
  requiresDocument: boolean;
  allowHalfDay: boolean;
  status: string;
}

export interface LeaveBalanceRow {
  leaveTypeId: string;
  name: string;
  code: string;
  isPaid: boolean;
  unlimited: boolean;
  entitled: number;
  carriedForward: number;
  used: number;
  pending: number;
  available: number | null;
}

export interface LeaveRequestRecord {
  id: string;
  startDate: string;
  endDate: string;
  halfDay: string;
  days: number;
  reason: string;
  status: string;
  appliedAt: string;
  reviewNote?: string | null;
  cancelReason?: string | null;
  leaveType?: { id: string; name: string; code: string; isPaid: boolean };
  staff?: { id: string; employeeId: string; fullName: string; department?: { name: string } | null };
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

async function json<T>(url: string, method: string, body?: unknown): Promise<T> {
  return parseOrThrow<T>(
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

function query(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  return q.toString();
}

export const hrAttendanceService = {
  // --- Work calendar ---
  async listHolidays(params: { year?: number; from?: string; to?: string } = {}): Promise<{ data: HolidayRecord[]; total: number }> {
    return parseOrThrow(await fetch(`/api/hr/holidays?${query(params)}`));
  },

  async createHoliday(input: Record<string, unknown>): Promise<HolidayRecord> {
    return json("/api/hr/holidays", "POST", input);
  },

  // --- Attendance ---
  async daySheet(params: { date: string; departmentId?: string; q?: string }): Promise<DaySheet> {
    return parseOrThrow(await fetch(`/api/hr/attendance?${query(params)}`));
  },

  async mark(date: string, entries: { staffId: string; status: string; remarks?: string }[]): Promise<{ marked: number }> {
    return json("/api/hr/attendance", "POST", { date, entries });
  },

  async summary(params: { year: number; month: number; departmentId?: string }): Promise<AttendanceSummary> {
    return parseOrThrow(await fetch(`/api/hr/attendance/summary?${query(params)}`));
  },

  async setLock(body: { year: number; month: number; action: "lock" | "reopen"; reason?: string }): Promise<unknown> {
    return json("/api/hr/attendance/lock", "POST", body);
  },

  // --- Leave ---
  async listLeaveTypes(): Promise<{ data: LeaveTypeRecord[]; total: number }> {
    return parseOrThrow(await fetch("/api/hr/leave-types"));
  },

  async listLeaveRequests(
    params: { status?: string; staffId?: string; page?: number } = {},
  ): Promise<{ data: LeaveRequestRecord[]; total: number; pendingCount: number }> {
    return parseOrThrow(await fetch(`/api/hr/leave-requests?${query(params)}`));
  },

  async applyForLeave(input: Record<string, unknown>): Promise<LeaveRequestRecord> {
    return json("/api/hr/leave-requests", "POST", input);
  },

  async decideLeave(id: string, decision: "approved" | "rejected", note?: string): Promise<LeaveRequestRecord> {
    return json(`/api/hr/leave-requests/${id}/decide`, "POST", { decision, note });
  },

  async cancelLeave(id: string, reason: string): Promise<LeaveRequestRecord> {
    return json(`/api/hr/leave-requests/${id}/cancel`, "POST", { reason });
  },

  async leaveBalances(params: { staffId?: string; year?: number } = {}): Promise<{
    staff: { id: string; employeeId: string; fullName: string };
    year: number;
    data: LeaveBalanceRow[];
  }> {
    return parseOrThrow(await fetch(`/api/hr/leave-balances?${query(params)}`));
  },
};
