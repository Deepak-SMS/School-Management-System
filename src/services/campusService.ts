import type { CampusInput } from "@/lib/validation/campus";
import type { CampusListResponse, CampusRecord } from "@/types/campus";
import type { ApiError } from "@/services/studentService";

export interface CampusTeacherEntry {
  id: string;
  fullName: string;
  designation: string;
  classes: string[];
}

export interface CampusListParams {
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

export const campusService = {
  async list(params: CampusListParams = {}): Promise<CampusListResponse> {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.status) query.set("status", params.status);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));

    const response = await fetch(`/api/campuses?${query.toString()}`);
    return parseOrThrow<CampusListResponse>(response);
  },

  async get(id: string): Promise<CampusRecord> {
    const response = await fetch(`/api/campuses/${id}`);
    return parseOrThrow<CampusRecord>(response);
  },

  async create(input: CampusInput): Promise<CampusRecord> {
    const response = await fetch("/api/campuses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<CampusRecord>(response);
  },

  async update(id: string, input: Partial<CampusInput>): Promise<CampusRecord> {
    const response = await fetch(`/api/campuses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<CampusRecord>(response);
  },

  async remove(id: string): Promise<void> {
    const response = await fetch(`/api/campuses/${id}`, { method: "DELETE" });
    await parseOrThrow(response);
  },

  async listTeachers(id: string): Promise<{ data: CampusTeacherEntry[] }> {
    const response = await fetch(`/api/campuses/${id}/teachers`);
    return parseOrThrow(response);
  },
};
