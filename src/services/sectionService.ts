import type { SectionInput } from "@/lib/validation/section";
import type { SectionListResponse, SectionRecord } from "@/types/section";
import type { ApiError } from "@/services/studentService";

export interface SectionSubjectEntry {
  id: string;
  name: string;
  subjectType: string;
  teacher?: { id: string; fullName: string } | null;
}

export interface SectionListParams {
  q?: string;
  classId?: string;
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

export const sectionService = {
  async list(params: SectionListParams = {}): Promise<SectionListResponse> {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.classId) query.set("classId", params.classId);
    if (params.campusId) query.set("campusId", params.campusId);
    if (params.academicYearId) query.set("academicYearId", params.academicYearId);
    if (params.status) query.set("status", params.status);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));

    const response = await fetch(`/api/sections?${query.toString()}`);
    return parseOrThrow<SectionListResponse>(response);
  },

  async get(id: string): Promise<SectionRecord> {
    const response = await fetch(`/api/sections/${id}`);
    return parseOrThrow<SectionRecord>(response);
  },

  async create(input: SectionInput): Promise<SectionRecord> {
    const response = await fetch("/api/sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<SectionRecord>(response);
  },

  async update(id: string, input: Partial<SectionInput>): Promise<SectionRecord> {
    const response = await fetch(`/api/sections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<SectionRecord>(response);
  },

  async remove(id: string): Promise<void> {
    const response = await fetch(`/api/sections/${id}`, { method: "DELETE" });
    await parseOrThrow(response);
  },

  async listSubjects(id: string): Promise<{ data: SectionSubjectEntry[] }> {
    const response = await fetch(`/api/sections/${id}/subjects`);
    return parseOrThrow(response);
  },
};
