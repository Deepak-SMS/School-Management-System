import type { ApiError } from "@/services/studentService";

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

export interface EmailTemplateRecord {
  id: string;
  name: string;
  description: string | null;
  category: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  variablesJson: string | null;
  isActive: boolean;
  updatedAt: string;
}

export interface EmailTemplateInput {
  name: string;
  description?: string;
  category: string;
  subject: string;
  bodyHtml: string;
  isActive?: boolean;
}

export interface EmailVariableGroup {
  label: string;
  fields: { key: string; label: string }[];
}

export const emailTemplateService = {
  async list(params: { category?: string; q?: string } = {}): Promise<{ data: EmailTemplateRecord[]; total: number }> {
    return parseOrThrow(await fetch(`/api/email/templates?${toQuery(params)}`));
  },
  async get(id: string): Promise<EmailTemplateRecord> {
    return parseOrThrow(await fetch(`/api/email/templates/${id}`));
  },
  async create(input: EmailTemplateInput): Promise<EmailTemplateRecord> {
    return parseOrThrow(await fetch("/api/email/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }));
  },
  async update(id: string, input: Partial<EmailTemplateInput>): Promise<EmailTemplateRecord> {
    return parseOrThrow(await fetch(`/api/email/templates/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }));
  },
  async remove(id: string): Promise<{ success: boolean }> {
    return parseOrThrow(await fetch(`/api/email/templates/${id}`, { method: "DELETE" }));
  },
  async preview(id: string, sample: { studentId?: string; sampleValues?: Record<string, string> }): Promise<{ subject: string; html: string; missingVariables: string[] }> {
    return parseOrThrow(await fetch(`/api/email/templates/${id}/preview`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sample) }));
  },
  async variables(): Promise<{ groups: EmailVariableGroup[] }> {
    return parseOrThrow(await fetch("/api/email/variables"));
  },
};
