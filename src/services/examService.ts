import type { ExamInput, ExamPatchInput } from "@/lib/validation/exam";
import type { ExamListResponse, ExamRecord } from "@/types/exam";
import type { ApiError } from "@/services/studentService";

export interface ExamListParams {
  q?: string;
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

export const examService = {
  async list(params: ExamListParams = {}): Promise<ExamListResponse> {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.academicYearId) query.set("academicYearId", params.academicYearId);
    if (params.status) query.set("status", params.status);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));

    const response = await fetch(`/api/exams?${query.toString()}`);
    return parseOrThrow<ExamListResponse>(response);
  },

  async get(id: string): Promise<ExamRecord> {
    const response = await fetch(`/api/exams/${id}`);
    return parseOrThrow<ExamRecord>(response);
  },

  async create(input: ExamInput): Promise<ExamRecord> {
    const response = await fetch("/api/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<ExamRecord>(response);
  },

  async update(id: string, input: ExamPatchInput): Promise<ExamRecord> {
    const response = await fetch(`/api/exams/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<ExamRecord>(response);
  },

  async remove(id: string): Promise<void> {
    const response = await fetch(`/api/exams/${id}`, { method: "DELETE" });
    await parseOrThrow(response);
  },
};
