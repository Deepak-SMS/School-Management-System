import type { ApiError } from "@/services/studentService";
import type { StudentFeeChargeInput, StudentFeeAdjustmentInput, StudentFeeTransferInput } from "@/lib/validation/student-fee";
import type {
  StudentFeeAccountRecord,
  StudentFeeChargeRecord,
  StudentFeeListResponse,
  AvailableFeeItemRecord,
} from "@/types/student-fees";

/**
 * Student Fees service layer. UI never calls `fetch` directly — it goes
 * through these, so swapping transport later is a change in one file (CLAUDE.md).
 */

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

function toQuery(params: Record<string, unknown>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    query.set(key, String(value));
  }
  return query.toString();
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseOrThrow<T>(response);
}

export interface StudentFeeListParams {
  q?: string;
  classId?: string;
  sectionId?: string;
  balance?: "outstanding" | "overdue" | "cleared";
  page?: number;
  pageSize?: number;
}

export const studentFeeService = {
  async list(params: StudentFeeListParams = {}): Promise<StudentFeeListResponse> {
    return parseOrThrow(await fetch(`/api/student-fees?${toQuery(params as Record<string, unknown>)}`));
  },

  async get(studentId: string): Promise<StudentFeeAccountRecord> {
    return parseOrThrow(await fetch(`/api/students/${studentId}/fees`));
  },

  async availableItems(studentId: string): Promise<{ data: AvailableFeeItemRecord[] }> {
    return parseOrThrow(await fetch(`/api/students/${studentId}/fees/available-items`));
  },

  async addCharge(studentId: string, input: StudentFeeChargeInput): Promise<{ data: StudentFeeChargeRecord[] }> {
    return postJson(`/api/students/${studentId}/fees/charges`, input);
  },

  async removeCharge(studentId: string, chargeId: string): Promise<{ success: boolean; cancelled: boolean }> {
    return parseOrThrow(await fetch(`/api/students/${studentId}/fees/charges/${chargeId}`, { method: "DELETE" }));
  },

  async addAdjustment(studentId: string, input: StudentFeeAdjustmentInput): Promise<StudentFeeChargeRecord> {
    return postJson(`/api/students/${studentId}/fees/adjustments`, input);
  },

  async transfer(studentId: string, input: StudentFeeTransferInput): Promise<{ success: boolean }> {
    return postJson(`/api/students/${studentId}/fees/transfer`, input);
  },
};
