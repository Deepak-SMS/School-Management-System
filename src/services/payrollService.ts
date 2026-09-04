import type { SalaryStructureInput, SalaryStructureAssignmentInput } from "@/lib/validation/salary-structure";
import type { PayrollPeriodCreateInput, PayrollProcessInput, PayrollReopenInput } from "@/lib/validation/payroll";
import type {
  SalaryStructureRecord,
  PayrollPeriodRecord,
  PayrollPeriodDetail,
  PayrollProcessResult,
  SalarySlipListResponse,
  SalaryStructureAssignmentRef,
} from "@/types/payroll";
import type { ApiError } from "@/services/studentService";

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

export const salaryStructureService = {
  async list(): Promise<{ data: SalaryStructureRecord[]; total: number }> {
    const response = await fetch("/api/salary-structures");
    return parseOrThrow(response);
  },

  async get(id: string): Promise<SalaryStructureRecord> {
    const response = await fetch(`/api/salary-structures/${id}`);
    return parseOrThrow(response);
  },

  async create(input: SalaryStructureInput): Promise<SalaryStructureRecord> {
    const response = await fetch("/api/salary-structures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow(response);
  },

  async update(id: string, input: SalaryStructureInput): Promise<SalaryStructureRecord> {
    const response = await fetch(`/api/salary-structures/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow(response);
  },

  async remove(id: string): Promise<{ deactivated: boolean; staffEverAssigned: number }> {
    const response = await fetch(`/api/salary-structures/${id}`, { method: "DELETE" });
    return parseOrThrow(response);
  },
};

export const salaryAssignmentService = {
  async list(staffId: string): Promise<{ data: SalaryStructureAssignmentRef[] }> {
    const response = await fetch(`/api/staff/${staffId}/salary-assignments`);
    return parseOrThrow(response);
  },

  async assign(staffId: string, input: SalaryStructureAssignmentInput): Promise<SalaryStructureAssignmentRef> {
    const response = await fetch(`/api/staff/${staffId}/salary-assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow(response);
  },
};

export const payrollPeriodService = {
  async list(): Promise<{ data: PayrollPeriodRecord[]; total: number }> {
    const response = await fetch("/api/payroll/periods");
    return parseOrThrow(response);
  },

  async get(id: string): Promise<PayrollPeriodDetail> {
    const response = await fetch(`/api/payroll/periods/${id}`);
    return parseOrThrow(response);
  },

  async create(input: PayrollPeriodCreateInput): Promise<PayrollPeriodRecord> {
    const response = await fetch("/api/payroll/periods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow(response);
  },

  async process(id: string, input: PayrollProcessInput = {}): Promise<PayrollProcessResult> {
    const response = await fetch(`/api/payroll/periods/${id}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow(response);
  },

  async approve(id: string): Promise<PayrollPeriodRecord> {
    const response = await fetch(`/api/payroll/periods/${id}/approve`, { method: "POST" });
    return parseOrThrow(response);
  },

  async lock(id: string): Promise<PayrollPeriodRecord> {
    const response = await fetch(`/api/payroll/periods/${id}/lock`, { method: "POST" });
    return parseOrThrow(response);
  },

  async reopen(id: string, input: PayrollReopenInput): Promise<PayrollPeriodRecord> {
    const response = await fetch(`/api/payroll/periods/${id}/reopen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow(response);
  },

  async generateSlips(id: string): Promise<{ generated: number; alreadyExisted: number }> {
    const response = await fetch(`/api/payroll/periods/${id}/generate-slips`, { method: "POST" });
    return parseOrThrow(response);
  },
};

export interface SalarySlipListParams {
  q?: string;
  periodId?: string;
  page?: number;
  pageSize?: number;
}

export const salarySlipService = {
  async list(params: SalarySlipListParams = {}): Promise<SalarySlipListResponse> {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.periodId) query.set("periodId", params.periodId);
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));
    const response = await fetch(`/api/salary-slips?${query.toString()}`);
    return parseOrThrow(response);
  },
};
