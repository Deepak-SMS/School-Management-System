import type { ApiError } from "@/services/studentService";
import type { ExpenseInput, ExpenseCategoryInput } from "@/lib/validation/expense";
import type { ExpenseStatus } from "@/lib/constants/expenses";

export interface ExpenseCategoryRecord {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  approvalThreshold?: number | null;
  status: string;
  sortOrder: number;
  _count?: { expenses: number };
}

export interface ExpenseAttachmentRecord {
  id: string;
  expenseId: string;
  uploadedFileId: string;
  kind: string;
  label?: string | null;
  createdAt: string;
  uploadedFile?: { id: string; originalName?: string | null; mimeType?: string | null; sizeBytes?: number | null };
}

export interface ExpenseEventRecord {
  id: string;
  fromStatus?: string | null;
  toStatus: string;
  actorName?: string | null;
  note?: string | null;
  occurredAt: string;
}

export interface ExpenseRecord {
  id: string;
  expenseNumber: string;
  title: string;
  description?: string | null;
  amount: number;
  taxAmount: number;
  expenseDate: string;
  payeeName: string;
  payeeContact?: string | null;
  payeeGstin?: string | null;
  paymentMethod?: string | null;
  referenceNo?: string | null;
  bankName?: string | null;
  paidOn?: string | null;
  status: ExpenseStatus;
  rejectionReason?: string | null;
  cancelReason?: string | null;
  note?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  createdAt: string;
  categoryId: string;
  category?: { id: string; name: string; code: string };
  attachments?: ExpenseAttachmentRecord[];
  events?: ExpenseEventRecord[];
}

export interface ExpenseTotals {
  byStatus: Record<string, { amount: number; count: number }>;
  awaitingApproval: number;
  approvedUnpaid: number;
  paid: number;
}

export interface ExpenseListResponse {
  data: ExpenseRecord[];
  total: number;
  page: number;
  pageSize: number;
  totals: ExpenseTotals;
}

export interface ExpenseListParams {
  q?: string;
  status?: string;
  categoryId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

async function json<T>(url: string, method: string, body?: unknown): Promise<T> {
  return parseOrThrow<T>(
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

export interface TransitionBody {
  to: ExpenseStatus;
  note?: string;
  paidOn?: string;
  paymentMethod?: string;
  referenceNo?: string;
  bankName?: string;
}

export const expenseService = {
  async list(params: ExpenseListParams = {}): Promise<ExpenseListResponse> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") query.set(key, String(value));
    }
    return parseOrThrow(await fetch(`/api/finance/expenses?${query.toString()}`));
  },

  async get(id: string): Promise<ExpenseRecord> {
    return parseOrThrow(await fetch(`/api/finance/expenses/${id}`));
  },

  async create(input: ExpenseInput): Promise<ExpenseRecord> {
    return json("/api/finance/expenses", "POST", input);
  },

  async update(id: string, input: Partial<ExpenseInput>): Promise<ExpenseRecord> {
    return json(`/api/finance/expenses/${id}`, "PATCH", input);
  },

  async remove(id: string): Promise<void> {
    await json(`/api/finance/expenses/${id}`, "DELETE");
  },

  /** Submit, approve, reject, pay or cancel — the workflow decides what's legal. */
  async transition(id: string, body: TransitionBody): Promise<ExpenseRecord> {
    return json(`/api/finance/expenses/${id}/transition`, "POST", body);
  },

  async listAttachments(id: string): Promise<{ data: ExpenseAttachmentRecord[]; total: number }> {
    return parseOrThrow(await fetch(`/api/finance/expenses/${id}/attachments`));
  },

  async addAttachment(
    id: string,
    body: { uploadedFileId: string; kind?: string; label?: string },
  ): Promise<ExpenseAttachmentRecord> {
    return json(`/api/finance/expenses/${id}/attachments`, "POST", body);
  },

  async removeAttachment(id: string, attachmentId: string): Promise<void> {
    await json(`/api/finance/expenses/${id}/attachments/${attachmentId}`, "DELETE");
  },

  /** Uploads the bill itself, then files it against the expense. */
  async uploadBill(id: string, file: File, kind?: string, label?: string): Promise<ExpenseAttachmentRecord> {
    const form = new FormData();
    form.append("file", file);
    form.append("kind", "expense_document");

    const uploaded = await parseOrThrow<{ id: string }>(
      await fetch("/api/uploads", { method: "POST", body: form }),
    );

    return this.addAttachment(id, { uploadedFileId: uploaded.id, kind, label });
  },

  async listCategories(includeInactive = false): Promise<{ data: ExpenseCategoryRecord[]; total: number }> {
    return parseOrThrow(
      await fetch(`/api/finance/expense-categories${includeInactive ? "?includeInactive=1" : ""}`),
    );
  },

  async createCategory(input: ExpenseCategoryInput): Promise<ExpenseCategoryRecord> {
    return json("/api/finance/expense-categories", "POST", input);
  },

  async updateCategory(id: string, input: Partial<ExpenseCategoryInput>): Promise<ExpenseCategoryRecord> {
    return json(`/api/finance/expense-categories/${id}`, "PATCH", input);
  },

  async removeCategory(id: string): Promise<void> {
    await json(`/api/finance/expense-categories/${id}`, "DELETE");
  },
};
