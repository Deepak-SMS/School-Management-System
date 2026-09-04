import type { ApiError } from "@/services/studentService";
import type { FeeCategoryInput } from "@/lib/validation/fee-category";
import type { FeeStudentCategoryInput } from "@/lib/validation/fee-student-category";
import type { LateFeeRuleInput } from "@/lib/validation/late-fee-rule";
import type { FeeStructureInput } from "@/lib/validation/fee-structure";
import type {
  FeeCategoryRecord,
  FeeStudentCategoryRecord,
  LateFeeRuleRecord,
  FeeStructureRecord,
  FeeStructureListResponse,
  FeeStructurePublishResult,
  EligibleStudentsPreview,
} from "@/types/fees";

/**
 * Fee Structure service layer. UI never calls `fetch` directly — it goes
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

export const feeCategoryService = {
  async list(params: { q?: string; status?: string } = {}): Promise<{ data: FeeCategoryRecord[]; total: number }> {
    return parseOrThrow(await fetch(`/api/fee-categories?${toQuery(params)}`));
  },
  async create(input: FeeCategoryInput): Promise<FeeCategoryRecord> {
    return postJson("/api/fee-categories", input);
  },
  async update(id: string, input: Partial<FeeCategoryInput>): Promise<FeeCategoryRecord> {
    return postJson(`/api/fee-categories/${id}`, input, "PATCH");
  },
  async remove(id: string): Promise<{ success: boolean; deactivated: boolean; items: number }> {
    return parseOrThrow(await fetch(`/api/fee-categories/${id}`, { method: "DELETE" }));
  },
};

export const feeStudentCategoryService = {
  async list(params: { q?: string; status?: string } = {}): Promise<{ data: FeeStudentCategoryRecord[]; total: number }> {
    return parseOrThrow(await fetch(`/api/fee-student-categories?${toQuery(params)}`));
  },
  async create(input: FeeStudentCategoryInput): Promise<FeeStudentCategoryRecord> {
    return postJson("/api/fee-student-categories", input);
  },
  async update(id: string, input: Partial<FeeStudentCategoryInput>): Promise<FeeStudentCategoryRecord> {
    return postJson(`/api/fee-student-categories/${id}`, input, "PATCH");
  },
  async remove(id: string): Promise<{ success: boolean; deactivated: boolean; students: number }> {
    return parseOrThrow(await fetch(`/api/fee-student-categories/${id}`, { method: "DELETE" }));
  },
};

export const lateFeeRuleService = {
  async list(params: { q?: string; status?: string } = {}): Promise<{ data: LateFeeRuleRecord[]; total: number }> {
    return parseOrThrow(await fetch(`/api/late-fee-rules?${toQuery(params)}`));
  },
  async create(input: LateFeeRuleInput): Promise<LateFeeRuleRecord> {
    return postJson("/api/late-fee-rules", input);
  },
  async update(id: string, input: Partial<LateFeeRuleInput>): Promise<LateFeeRuleRecord> {
    return postJson(`/api/late-fee-rules/${id}`, input, "PATCH");
  },
  async remove(id: string): Promise<{ success: boolean; deactivated: boolean; items: number }> {
    return parseOrThrow(await fetch(`/api/late-fee-rules/${id}`, { method: "DELETE" }));
  },
};

export interface FeeStructureListParams {
  q?: string;
  academicYearId?: string;
  classId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export const feeStructureService = {
  async list(params: FeeStructureListParams = {}): Promise<FeeStructureListResponse> {
    return parseOrThrow(await fetch(`/api/fee-structures?${toQuery(params as Record<string, unknown>)}`));
  },

  async get(id: string): Promise<FeeStructureRecord> {
    return parseOrThrow(await fetch(`/api/fee-structures/${id}`));
  },

  async create(input: FeeStructureInput): Promise<FeeStructureRecord> {
    return postJson("/api/fee-structures", input);
  },

  async update(id: string, input: Partial<FeeStructureInput>): Promise<FeeStructureRecord> {
    return postJson(`/api/fee-structures/${id}`, input, "PATCH");
  },

  async remove(id: string): Promise<void> {
    await parseOrThrow(await fetch(`/api/fee-structures/${id}`, { method: "DELETE" }));
  },

  /** Counts students who currently match the structure's class/section/category — shown before publishing so admins know the blast radius. */
  async previewEligibleStudents(id: string): Promise<EligibleStudentsPreview> {
    return parseOrThrow(await fetch(`/api/fee-structures/${id}/eligible-students`));
  },

  /** Moves draft → published and auto-creates FeeStructureAssignment rows for every matching student. Safe to call again later to pick up newly-matching students. */
  async publish(id: string): Promise<FeeStructurePublishResult> {
    return postJson(`/api/fee-structures/${id}/publish`, {});
  },

  async archive(id: string): Promise<FeeStructureRecord> {
    return postJson(`/api/fee-structures/${id}/archive`, {});
  },

  /** Copies a structure's items/installments into a new draft — for reusing last year's structure on a new academic year. */
  async duplicate(id: string, input: { academicYearId: string; name?: string }): Promise<FeeStructureRecord> {
    return postJson(`/api/fee-structures/${id}/duplicate`, input);
  },
};
