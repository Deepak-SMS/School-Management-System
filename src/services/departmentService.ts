import type { DepartmentInput } from "@/lib/validation/department";
import type { DepartmentListResponse, DepartmentRecord } from "@/types/department";
import type { ApiError } from "@/services/studentService";

export interface DepartmentStaffRecord {
  id: string;
  fullName: string;
  employeeId: string;
  designation: string;
  category: string;
  employmentStatus: string;
}

export interface DepartmentListParams {
  q?: string;
  status?: string;
  departmentType?: string;
  campusId?: string;
  page?: number;
  pageSize?: number;
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

export const departmentService = {
  async list(params: DepartmentListParams = {}): Promise<DepartmentListResponse> {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.status) query.set("status", params.status);
    if (params.departmentType) query.set("departmentType", params.departmentType);
    if (params.campusId) query.set("campusId", params.campusId);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));

    const response = await fetch(`/api/departments?${query.toString()}`);
    return parseOrThrow<DepartmentListResponse>(response);
  },

  async get(id: string): Promise<DepartmentRecord> {
    const response = await fetch(`/api/departments/${id}`);
    return parseOrThrow<DepartmentRecord>(response);
  },

  async create(input: DepartmentInput): Promise<DepartmentRecord> {
    const response = await fetch("/api/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<DepartmentRecord>(response);
  },

  async update(id: string, input: Partial<DepartmentInput>): Promise<DepartmentRecord> {
    const response = await fetch(`/api/departments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<DepartmentRecord>(response);
  },

  async remove(id: string): Promise<void> {
    const response = await fetch(`/api/departments/${id}`, { method: "DELETE" });
    await parseOrThrow(response);
  },

  async listStaff(id: string): Promise<{ data: DepartmentStaffRecord[] }> {
    const response = await fetch(`/api/departments/${id}/staff`);
    return parseOrThrow(response);
  },
};
