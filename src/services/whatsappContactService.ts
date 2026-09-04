import type { ApiError } from "@/services/studentService";
import type { WhatsAppContactImportMappingInput } from "@/lib/validation/whatsapp-contact";
import type { ContactImportValidateResult, InspectedWorkbook, ContactImportValidRow } from "@/lib/whatsapp/contact-import";

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

export interface WhatsAppContactRecord {
  id: string;
  name: string;
  phoneE164: string;
  rawPhone: string | null;
  source: string;
  tagsJson: string | null;
  optedOut: boolean;
  optedOutAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface WhatsAppContactInput {
  name: string;
  phone: string;
  tags?: string[];
  notes?: string;
}

export interface WhatsAppContactListParams {
  q?: string;
  tag?: string;
  optedOut?: boolean;
  page?: number;
  pageSize?: number;
}

export const whatsappContactService = {
  async list(params: WhatsAppContactListParams = {}): Promise<{ data: WhatsAppContactRecord[]; total: number }> {
    return parseOrThrow(await fetch(`/api/whatsapp/contacts?${toQuery(params as Record<string, unknown>)}`));
  },
  async get(id: string): Promise<WhatsAppContactRecord> {
    return parseOrThrow(await fetch(`/api/whatsapp/contacts/${id}`));
  },
  async create(input: WhatsAppContactInput): Promise<WhatsAppContactRecord> {
    return parseOrThrow(await fetch("/api/whatsapp/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }));
  },
  async update(id: string, input: Partial<WhatsAppContactInput>): Promise<WhatsAppContactRecord> {
    return parseOrThrow(await fetch(`/api/whatsapp/contacts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }));
  },
  async remove(id: string): Promise<{ success: boolean; deactivated: boolean }> {
    return parseOrThrow(await fetch(`/api/whatsapp/contacts/${id}`, { method: "DELETE" }));
  },
  async optOut(id: string, reason?: string): Promise<WhatsAppContactRecord> {
    return parseOrThrow(await fetch(`/api/whatsapp/contacts/${id}/opt-out`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) }));
  },
  async downloadImportTemplate(): Promise<void> {
    const response = await fetch("/api/whatsapp/contacts/import/template");
    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: "The download failed." }));
      throw body as ApiError;
    }
    const blob = await response.blob();
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "whatsapp-contacts-template.xlsx";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(href);
  },
  async importInspect(file: File): Promise<InspectedWorkbook> {
    const form = new FormData();
    form.append("file", file);
    return parseOrThrow(await fetch("/api/whatsapp/contacts/import/inspect", { method: "POST", body: form }));
  },
  async importValidate(file: File, mapping: WhatsAppContactImportMappingInput): Promise<ContactImportValidateResult> {
    const form = new FormData();
    form.append("file", file);
    form.append("mapping", JSON.stringify(mapping));
    return parseOrThrow(await fetch("/api/whatsapp/contacts/import/validate", { method: "POST", body: form }));
  },
  async importCommit(rows: ContactImportValidRow[]): Promise<{ success: boolean; created: number; updated: number }> {
    return parseOrThrow(
      await fetch("/api/whatsapp/contacts/import/commit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) }),
    );
  },
};
