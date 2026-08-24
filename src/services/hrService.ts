import type { ApiError } from "@/services/studentService";
import type { StaffInput, StaffEducationInput, StaffExperienceInput } from "@/lib/validation/staff";
import type { DesignationInput } from "@/lib/validation/designation";
import type { EmployeeTypeInput } from "@/lib/validation/employeeType";
import type {
  EmployeeRecord,
  EmployeeDetail,
  EmployeeListParams,
  EmployeeDocument,
  EmployeeEducation,
  EmployeeExperience,
  EmployeeActivity,
  DesignationRecord,
  EmployeeTypeRecord,
  HrLookups,
  PagedResponse,
} from "@/types/hr";

/**
 * HR service layer. UI never calls `fetch` directly — it goes through these, so
 * swapping transport later is a change in one file per resource (CLAUDE.md).
 *
 * A non-2xx body is thrown as `ApiError`, which carries `fieldErrors` from Zod
 * and `permission` from a 403 so forms can surface either.
 */

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

function toQuery(params: Record<string, unknown>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    query.set(key, String(value));
  }
  return query.toString();
}

async function postJson<T>(url: string, body: unknown, method: "POST" | "PATCH" = "POST"): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseOrThrow<T>(response);
}

export const employeeService = {
  async list(params: EmployeeListParams = {}): Promise<PagedResponse<EmployeeRecord>> {
    return parseOrThrow(await fetch(`/api/staff?${toQuery(params as Record<string, unknown>)}`));
  },

  async get(id: string): Promise<EmployeeDetail> {
    return parseOrThrow(await fetch(`/api/staff/${id}`));
  },

  async create(input: StaffInput): Promise<EmployeeRecord> {
    return postJson("/api/staff", input);
  },

  async update(id: string, input: Partial<StaffInput>): Promise<EmployeeRecord> {
    return postJson(`/api/staff/${id}`, input, "PATCH");
  },

  /** Soft-deactivate — sets an employment status, never removes the record. */
  async deactivate(id: string, status: string, reason?: string): Promise<{ success: boolean }> {
    const query = toQuery({ status, reason });
    return parseOrThrow(await fetch(`/api/staff/${id}?${query}`, { method: "DELETE" }));
  },

  async activity(id: string): Promise<{ data: EmployeeActivity[] }> {
    return parseOrThrow(await fetch(`/api/staff/${id}/activity`));
  },

  async documents(id: string): Promise<{ data: EmployeeDocument[] }> {
    return parseOrThrow(await fetch(`/api/staff/${id}/documents`));
  },

  async addDocument(
    id: string,
    input: { documentType: string; title?: string; uploadedFileId: string; expiryDate?: string },
  ): Promise<EmployeeDocument> {
    return postJson(`/api/staff/${id}/documents`, input);
  },

  async reviewDocument(
    id: string,
    docId: string,
    input: { status: "verified" | "rejected"; rejectionNote?: string },
  ): Promise<EmployeeDocument> {
    return postJson(`/api/staff/${id}/documents/${docId}`, input, "PATCH");
  },

  async education(id: string): Promise<{ data: EmployeeEducation[] }> {
    return parseOrThrow(await fetch(`/api/staff/${id}/education`));
  },

  async addEducation(id: string, input: StaffEducationInput): Promise<EmployeeEducation> {
    return postJson(`/api/staff/${id}/education`, input);
  },

  async experience(id: string): Promise<{ data: EmployeeExperience[] }> {
    return parseOrThrow(await fetch(`/api/staff/${id}/experience`));
  },

  async addExperience(id: string, input: StaffExperienceInput): Promise<EmployeeExperience> {
    return postJson(`/api/staff/${id}/experience`, input);
  },

  async transfer(
    id: string,
    input: {
      toDepartmentId?: string;
      toDesignationId?: string;
      toCampusId?: string;
      toManagerId?: string;
      toWorkLocation?: string;
      reason?: string;
      effectiveDate: string;
    },
  ): Promise<{ success: boolean }> {
    return postJson(`/api/staff/${id}/transfer`, input);
  },
};

export const hrLookupService = {
  async all(): Promise<HrLookups> {
    return parseOrThrow(await fetch("/api/hr/lookups"));
  },
};

export const designationService = {
  async list(params: { q?: string; status?: string; departmentId?: string } = {}): Promise<{
    data: DesignationRecord[];
    total: number;
  }> {
    return parseOrThrow(await fetch(`/api/designations?${toQuery(params)}`));
  },
  async create(input: DesignationInput): Promise<DesignationRecord> {
    return postJson("/api/designations", input);
  },
  async update(id: string, input: Partial<DesignationInput>): Promise<DesignationRecord> {
    return postJson(`/api/designations/${id}`, input, "PATCH");
  },
  async remove(id: string): Promise<{ success: boolean; deactivated: boolean; employees: number }> {
    return parseOrThrow(await fetch(`/api/designations/${id}`, { method: "DELETE" }));
  },
};

export const employeeTypeService = {
  async list(params: { q?: string; status?: string } = {}): Promise<{ data: EmployeeTypeRecord[]; total: number }> {
    return parseOrThrow(await fetch(`/api/employee-types?${toQuery(params)}`));
  },
  async create(input: EmployeeTypeInput): Promise<EmployeeTypeRecord> {
    return postJson("/api/employee-types", input);
  },
  async update(id: string, input: Partial<EmployeeTypeInput>): Promise<EmployeeTypeRecord> {
    return postJson(`/api/employee-types/${id}`, input, "PATCH");
  },
  async remove(id: string): Promise<{ success: boolean; deactivated: boolean; employees: number }> {
    return parseOrThrow(await fetch(`/api/employee-types/${id}`, { method: "DELETE" }));
  },
};

/** Uploads a file and returns its stored id — used by document and photo upload. */
export const uploadService = {
  async upload(file: File, kind: string): Promise<{ id: string; url: string }> {
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    return parseOrThrow(await fetch("/api/uploads", { method: "POST", body: form }));
  },
};
