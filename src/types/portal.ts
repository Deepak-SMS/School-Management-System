import type { StudentFeeAccountRecord } from "@/types/student-fees";

export interface PortalChild {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  classId: string;
  className: string;
  sectionId: string | null;
  sectionName: string | null;
}

export interface PortalAttendanceRecord {
  id: string;
  date: string;
  status: string;
  remarks: string | null;
}

export interface PortalAttendanceSummary {
  totalMarked: number;
  present: number;
  attendancePct: number | null;
}

export interface PortalAttendanceResponse {
  data: PortalAttendanceRecord[];
  summary: PortalAttendanceSummary;
}

export interface PortalTimetableSlot {
  id: string;
  dayOfWeek: string;
  subject: { id: string; name: string; code: string };
  teacher: { id: string; fullName: string } | null;
  room: { id: string; name: string } | null;
  period: { id: string; label: string; startTime: string; endTime: string; sortOrder: number };
}

/** Same shape as GET /api/students/[id]/fees, minus the `student` ref the portal already knows from the active child. */
export type PortalFeeAccount = Omit<StudentFeeAccountRecord, "student">;

export interface PortalTransport {
  route: { id: string; name: string; routeNumber: string | null; morningTiming: string | null; afternoonTiming: string | null };
  pickupStop: { id: string; name: string; landmark: string | null };
  dropStop: { id: string; name: string; landmark: string | null } | null;
  direction: string;
  vehicle: { id: string; vehicleNumber: string; vehicleType: string } | null;
  driver: { id: string; fullName: string; phone: string | null } | null;
}

export interface PortalCertificate {
  id: string;
  certificateNumber: string;
  status: string;
  issueDate: string;
  pdfUrl: string | null;
  certificateType: { name: string; category: string };
}

export interface PortalDashboard {
  attendance: PortalAttendanceSummary;
  nextClass: (PortalTimetableSlot & { dayOfWeek: string }) | null;
  fees: PortalFeeAccount["summary"] | null;
  certificateCount: number;
}
