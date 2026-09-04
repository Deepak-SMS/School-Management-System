import type { StudentInput } from "@/lib/validation/student";
import type { StudentDocumentRecord, StudentListResponse, StudentRecord } from "@/types/student";

export interface StudentListParams {
  q?: string;
  classId?: string;
  sectionId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface ApiError {
  error: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

export interface StudentAttendanceSummary {
  student: { id: string; firstName: string; lastName: string };
  academicYear: { id: string; label: string };
  summary: { total: number; present: number; absent: number; byStatus: Record<string, number>; percentage: number };
  bySubject: { subjectId: string; subjectName: string; subjectCode: string; present: number; absent: number; total: number; percentage: number }[];
}

export interface StudentAttendanceCalendar {
  student: { id: string; firstName: string; lastName: string };
  month: string;
  days: { date: string; status: string; remarks: string | null }[];
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

export const studentService = {
  async list(params: StudentListParams = {}): Promise<StudentListResponse> {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.classId) query.set("classId", params.classId);
    if (params.sectionId) query.set("sectionId", params.sectionId);
    if (params.status) query.set("status", params.status);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));

    const response = await fetch(`/api/students?${query.toString()}`);
    return parseOrThrow<StudentListResponse>(response);
  },

  async get(id: string): Promise<StudentRecord> {
    const response = await fetch(`/api/students/${id}`);
    return parseOrThrow<StudentRecord>(response);
  },

  async create(input: StudentInput): Promise<StudentRecord> {
    const response = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<StudentRecord>(response);
  },

  async update(id: string, input: Partial<StudentInput>): Promise<StudentRecord> {
    const response = await fetch(`/api/students/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<StudentRecord>(response);
  },

  async suggestAdmissionNumber(): Promise<string> {
    const response = await fetch("/api/students/admission-number");
    const body = await parseOrThrow<{ suggested: string }>(response);
    return body.suggested;
  },

  async isAdmissionNumberAvailable(value: string, excludeId?: string): Promise<boolean> {
    const query = new URLSearchParams({ value });
    if (excludeId) query.set("excludeId", excludeId);
    const response = await fetch(`/api/students/admission-number?${query.toString()}`);
    const body = await parseOrThrow<{ available: boolean }>(response);
    return body.available;
  },

  async listDocuments(id: string): Promise<{ data: StudentDocumentRecord[]; total: number }> {
    const response = await fetch(`/api/students/${id}/documents`);
    return parseOrThrow<{ data: StudentDocumentRecord[]; total: number }>(response);
  },

  async getAttendance(id: string, academicYearId?: string): Promise<StudentAttendanceSummary> {
    const query = academicYearId ? `?academicYearId=${academicYearId}` : "";
    const response = await fetch(`/api/students/${id}/attendance${query}`);
    return parseOrThrow<StudentAttendanceSummary>(response);
  },

  async getAttendanceCalendar(id: string, month?: string): Promise<StudentAttendanceCalendar> {
    const query = month ? `?month=${month}` : "";
    const response = await fetch(`/api/students/${id}/attendance/calendar${query}`);
    return parseOrThrow<StudentAttendanceCalendar>(response);
  },

  async remove(id: string): Promise<void> {
    const response = await fetch(`/api/students/${id}`, { method: "DELETE" });
    await parseOrThrow(response);
  },
};
