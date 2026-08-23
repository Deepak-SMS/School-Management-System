import type { StaffInput } from "@/lib/validation/staff";
import type { StaffListResponse, StaffRecord } from "@/types/staff";
import type { ApiError } from "@/services/studentService";

export interface StaffListParams {
  q?: string;
  category?: string;
  employmentStatus?: string;
  page?: number;
  pageSize?: number;
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

export const staffService = {
  async list(params: StaffListParams = {}): Promise<StaffListResponse> {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.category) query.set("category", params.category);
    if (params.employmentStatus) query.set("employmentStatus", params.employmentStatus);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));

    const response = await fetch(`/api/staff?${query.toString()}`);
    return parseOrThrow<StaffListResponse>(response);
  },

  async get(id: string): Promise<StaffRecord> {
    const response = await fetch(`/api/staff/${id}`);
    return parseOrThrow<StaffRecord>(response);
  },

  async create(input: StaffInput): Promise<StaffRecord> {
    const response = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<StaffRecord>(response);
  },

  async update(id: string, input: Partial<StaffInput>): Promise<StaffRecord> {
    const response = await fetch(`/api/staff/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<StaffRecord>(response);
  },

  async remove(id: string): Promise<void> {
    const response = await fetch(`/api/staff/${id}`, { method: "DELETE" });
    await parseOrThrow(response);
  },
};
