import type { ApiError } from "@/services/studentService";
import type {
  PortalChild,
  PortalAttendanceResponse,
  PortalTimetableSlot,
  PortalFeeAccount,
  PortalTransport,
  PortalCertificate,
  PortalDashboard,
} from "@/types/portal";

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

function withStudentId(studentId?: string): string {
  return studentId ? `?studentId=${encodeURIComponent(studentId)}` : "";
}

/**
 * Portal service layer — every widget's read, going through /api/portal/*.
 * Same "UI never fetches directly" convention as every other *Service
 * (CLAUDE.md); the actual authorization/row-scoping lives server-side in
 * src/lib/portal-scope.ts, not here.
 */
export const portalService = {
  async listChildren(): Promise<{ data: PortalChild[] }> {
    return parseOrThrow(await fetch("/api/portal/children"));
  },

  async getDashboard(studentId?: string): Promise<PortalDashboard> {
    return parseOrThrow(await fetch(`/api/portal/dashboard${withStudentId(studentId)}`));
  },

  async getAttendance(studentId?: string, from?: string, to?: string): Promise<PortalAttendanceResponse> {
    const query = new URLSearchParams();
    if (studentId) query.set("studentId", studentId);
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    return parseOrThrow(await fetch(`/api/portal/attendance?${query.toString()}`));
  },

  async getTimetable(studentId?: string): Promise<{ data: PortalTimetableSlot[] }> {
    return parseOrThrow(await fetch(`/api/portal/timetable${withStudentId(studentId)}`));
  },

  async getFees(studentId?: string): Promise<PortalFeeAccount> {
    return parseOrThrow(await fetch(`/api/portal/fees${withStudentId(studentId)}`));
  },

  async getTransport(studentId?: string): Promise<{ data: PortalTransport | null }> {
    return parseOrThrow(await fetch(`/api/portal/transport${withStudentId(studentId)}`));
  },

  async getCertificates(studentId?: string): Promise<{ data: PortalCertificate[] }> {
    return parseOrThrow(await fetch(`/api/portal/certificates${withStudentId(studentId)}`));
  },
};
