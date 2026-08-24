import type { AcademicYearInput, CopyConfigInput } from "@/lib/validation/academicYear";
import type { AcademicYearListResponse, AcademicYearRecord } from "@/types/academicYear";
import type { ApiError } from "@/services/studentService";

export interface AcademicYearListParams {
  q?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

export const academicYearService = {
  async list(params: AcademicYearListParams = {}): Promise<AcademicYearListResponse> {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.status) query.set("status", params.status);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));

    const response = await fetch(`/api/academic-years?${query.toString()}`);
    return parseOrThrow<AcademicYearListResponse>(response);
  },

  async get(id: string): Promise<AcademicYearRecord> {
    const response = await fetch(`/api/academic-years/${id}`);
    return parseOrThrow<AcademicYearRecord>(response);
  },

  async create(input: AcademicYearInput, copyConfig?: CopyConfigInput): Promise<AcademicYearRecord> {
    const response = await fetch("/api/academic-years", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, copyConfig }),
    });
    return parseOrThrow<AcademicYearRecord>(response);
  },

  async update(id: string, input: Partial<AcademicYearInput>): Promise<AcademicYearRecord> {
    const response = await fetch(`/api/academic-years/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<AcademicYearRecord>(response);
  },

  async setActive(id: string): Promise<AcademicYearRecord> {
    return this.update(id, { status: "active" } as Partial<AcademicYearInput>);
  },

  async remove(id: string): Promise<void> {
    const response = await fetch(`/api/academic-years/${id}`, { method: "DELETE" });
    await parseOrThrow(response);
  },
};
