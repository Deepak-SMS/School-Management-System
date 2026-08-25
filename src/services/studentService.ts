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

  async listDocuments(id: string): Promise<{ data: StudentDocumentRecord[]; total: number }> {
    const response = await fetch(`/api/students/${id}/documents`);
    return parseOrThrow<{ data: StudentDocumentRecord[]; total: number }>(response);
  },

  async remove(id: string): Promise<void> {
    const response = await fetch(`/api/students/${id}`, { method: "DELETE" });
    await parseOrThrow(response);
  },
};
