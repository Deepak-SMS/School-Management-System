import type { ClassInput } from "@/lib/validation/class";
import type { ClassListResponse, ClassRecord } from "@/types/class";
import type { ApiError } from "@/services/studentService";

export interface ClassTeacherEntry {
  id: string;
  fullName: string;
  designation: string;
  subjects: string[];
}

export interface ClassListParams {
  q?: string;
  campusId?: string;
  academicYearId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

export const classService = {
  async list(params: ClassListParams = {}): Promise<ClassListResponse> {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.campusId) query.set("campusId", params.campusId);
    if (params.academicYearId) query.set("academicYearId", params.academicYearId);
    if (params.status) query.set("status", params.status);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));

    const response = await fetch(`/api/classes?${query.toString()}`);
    return parseOrThrow<ClassListResponse>(response);
  },

  async get(id: string): Promise<ClassRecord> {
    const response = await fetch(`/api/classes/${id}`);
    return parseOrThrow<ClassRecord>(response);
  },

  async create(input: ClassInput): Promise<ClassRecord> {
    const response = await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<ClassRecord>(response);
  },

  async update(id: string, input: Partial<ClassInput>): Promise<ClassRecord> {
    const response = await fetch(`/api/classes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<ClassRecord>(response);
  },

  async remove(id: string): Promise<void> {
    const response = await fetch(`/api/classes/${id}`, { method: "DELETE" });
    await parseOrThrow(response);
  },

  async listTeachers(id: string): Promise<{ data: ClassTeacherEntry[] }> {
    const response = await fetch(`/api/classes/${id}/teachers`);
    return parseOrThrow(response);
  },
};
