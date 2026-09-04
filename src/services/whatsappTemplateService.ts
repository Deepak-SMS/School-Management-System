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

export interface WhatsAppTemplateRecord {
  id: string;
  name: string;
  category: string;
  bodyText: string;
  variablesJson: string | null;
  isActive: boolean;
  updatedAt: string;
}

export interface WhatsAppTemplateInput {
  name: string;
  category: string;
  bodyText: string;
  isActive?: boolean;
}

export const whatsappTemplateService = {
  async list(params: { category?: string; q?: string } = {}): Promise<{ data: WhatsAppTemplateRecord[]; total: number }> {
    return parseOrThrow(await fetch(`/api/whatsapp/templates?${toQuery(params)}`));
  },
  async get(id: string): Promise<WhatsAppTemplateRecord> {
    return parseOrThrow(await fetch(`/api/whatsapp/templates/${id}`));
  },
  async create(input: WhatsAppTemplateInput): Promise<WhatsAppTemplateRecord> {
    return parseOrThrow(await fetch("/api/whatsapp/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }));
  },
  async update(id: string, input: Partial<WhatsAppTemplateInput>): Promise<WhatsAppTemplateRecord> {
    return parseOrThrow(await fetch(`/api/whatsapp/templates/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }));
  },
  async remove(id: string): Promise<{ success: boolean }> {
    return parseOrThrow(await fetch(`/api/whatsapp/templates/${id}`, { method: "DELETE" }));
  },
  async preview(id: string, sample: { studentId?: string; sampleValues?: Record<string, string> }): Promise<{ text: string; missingVariables: string[] }> {
    return parseOrThrow(await fetch(`/api/whatsapp/templates/${id}/preview`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sample) }));
  },
};
