import type { CreateSchoolInput, UpdateSchoolInput } from "@/lib/validation/platform-school";
import type {
  CreatedSchoolAdmin,
  CreateSchoolResult,
  PlatformAuditLogResponse,
  SchoolDetail,
  SchoolListResponse,
} from "@/types/platform";
import type { ApiError } from "@/services/studentService";

export interface SchoolListParams {
  q?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditLogListParams {
  page?: number;
  pageSize?: number;
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

export const platformService = {
  async listSchools(params: SchoolListParams = {}): Promise<SchoolListResponse> {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.status) query.set("status", params.status);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));

    const response = await fetch(`/api/platform/schools?${query.toString()}`);
    return parseOrThrow<SchoolListResponse>(response);
  },

  async createSchool(input: CreateSchoolInput): Promise<CreateSchoolResult> {
    const response = await fetch("/api/platform/schools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<CreateSchoolResult>(response);
  },

  async getSchool(id: string): Promise<SchoolDetail> {
    const response = await fetch(`/api/platform/schools/${id}`);
    return parseOrThrow<SchoolDetail>(response);
  },

  async updateSchool(id: string, input: UpdateSchoolInput): Promise<SchoolDetail> {
    const response = await fetch(`/api/platform/schools/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<SchoolDetail>(response);
  },

  async deleteSchool(id: string): Promise<void> {
    const response = await fetch(`/api/platform/schools/${id}`, { method: "DELETE" });
    await parseOrThrow<{ success: true }>(response);
  },

  async resetAdminPassword(id: string): Promise<CreatedSchoolAdmin> {
    const response = await fetch(`/api/platform/schools/${id}/reset-admin-password`, { method: "POST" });
    const body = await parseOrThrow<{ admin: CreatedSchoolAdmin }>(response);
    return body.admin;
  },

  async listAuditLog(params: AuditLogListParams = {}): Promise<PlatformAuditLogResponse> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));

    const response = await fetch(`/api/platform/audit-log?${query.toString()}`);
    return parseOrThrow<PlatformAuditLogResponse>(response);
  },
};
