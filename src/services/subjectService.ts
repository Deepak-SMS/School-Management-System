import type { SubjectInput, SubjectAssignmentInput } from "@/lib/validation/subject";
import type { SubjectAssignmentRecord, SubjectListResponse, SubjectRecord } from "@/types/subject";
import type { ApiError } from "@/services/studentService";

export interface SubjectListParams {
  q?: string;
  subjectType?: string;
  status?: string;
  academicYearId?: string;
  classId?: string;
  page?: number;
  pageSize?: number;
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

export const subjectService = {
  async list(params: SubjectListParams = {}): Promise<SubjectListResponse> {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.subjectType) query.set("subjectType", params.subjectType);
    if (params.status) query.set("status", params.status);
    if (params.academicYearId) query.set("academicYearId", params.academicYearId);
    if (params.classId) query.set("classId", params.classId);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));

    const response = await fetch(`/api/subjects?${query.toString()}`);
    return parseOrThrow<SubjectListResponse>(response);
  },

  async get(id: string): Promise<SubjectRecord> {
    const response = await fetch(`/api/subjects/${id}`);
    return parseOrThrow<SubjectRecord>(response);
  },

  async create(input: SubjectInput): Promise<SubjectRecord> {
    const response = await fetch("/api/subjects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<SubjectRecord>(response);
  },

  async update(id: string, input: Partial<SubjectInput>): Promise<SubjectRecord> {
    const response = await fetch(`/api/subjects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<SubjectRecord>(response);
  },

  async remove(id: string): Promise<void> {
    const response = await fetch(`/api/subjects/${id}`, { method: "DELETE" });
    await parseOrThrow(response);
  },

  async assign(subjectId: string, input: SubjectAssignmentInput): Promise<SubjectAssignmentRecord> {
    const response = await fetch(`/api/subjects/${subjectId}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<SubjectAssignmentRecord>(response);
  },

  async unassign(subjectId: string, assignmentId: string): Promise<void> {
    const response = await fetch(`/api/subjects/${subjectId}/assignments/${assignmentId}`, { method: "DELETE" });
    await parseOrThrow(response);
  },
};
