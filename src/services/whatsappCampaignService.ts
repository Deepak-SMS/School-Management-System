import type { ApiError } from "@/services/studentService";
import type { WhatsAppAudienceMode } from "@/lib/whatsapp/audience-modes";

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

export interface WhatsAppCampaignRecord {
  id: string;
  name: string;
  templateId: string | null;
  template?: { name: string } | null;
  messageBody: string;
  audienceMode: string;
  audienceFilterJson: string | null;
  status: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  invalidNumberCount: number;
  optedOutCount: number;
  skippedCount: number;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

export interface WhatsAppCampaignInput {
  name: string;
  templateId?: string;
  messageBody: string;
  audienceMode: WhatsAppAudienceMode;
  classId?: string;
  sectionId?: string;
  thresholdPct?: number;
  tag?: string;
  contactIds?: string[];
}

export interface WhatsAppCampaignValidateResult {
  totalRecipients: number;
  sendableCount: number;
  invalidPhoneCount: number;
  optedOutCount: number;
  missingVariableCount: number;
  missingVariableSample: { recipientName: string; missingVariables: string[] }[];
}

export interface WhatsAppAudiencePreviewRow {
  studentName: string | null;
  guardianName: string;
  phone: string | null;
  className: string | null;
  sectionName: string | null;
}

export interface WhatsAppAudiencePreview {
  label: string;
  total: number;
  classTeacher: string | null;
  sample: WhatsAppAudiencePreviewRow[];
  truncated: boolean;
}

export interface WhatsAppMessageJobRecord {
  id: string;
  recipientName: string;
  phoneE164: string;
  messageText: string;
  status: string;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  queuedAt: string;
}

export const whatsappCampaignService = {
  async list(params: { status?: string } = {}): Promise<{ data: WhatsAppCampaignRecord[]; total: number }> {
    return parseOrThrow(await fetch(`/api/whatsapp/campaigns?${toQuery(params)}`));
  },
  async get(id: string): Promise<WhatsAppCampaignRecord> {
    return parseOrThrow(await fetch(`/api/whatsapp/campaigns/${id}`));
  },
  async create(input: WhatsAppCampaignInput): Promise<WhatsAppCampaignRecord & { audienceLabel: string }> {
    return parseOrThrow(await fetch("/api/whatsapp/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }));
  },
  async previewAudience(input: Omit<WhatsAppCampaignInput, "name" | "messageBody" | "templateId">): Promise<WhatsAppAudiencePreview> {
    return parseOrThrow(await fetch("/api/whatsapp/campaigns/preview-audience", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }));
  },
  async update(id: string, input: Partial<WhatsAppCampaignInput>): Promise<WhatsAppCampaignRecord> {
    return parseOrThrow(await fetch(`/api/whatsapp/campaigns/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }));
  },
  async remove(id: string): Promise<{ success: boolean }> {
    return parseOrThrow(await fetch(`/api/whatsapp/campaigns/${id}`, { method: "DELETE" }));
  },
  async validate(id: string): Promise<WhatsAppCampaignValidateResult> {
    return parseOrThrow(await fetch(`/api/whatsapp/campaigns/${id}/validate`, { method: "POST" }));
  },
  async send(id: string): Promise<{ success: boolean; total: number; pending: number; invalidNumber: number; optedOut: number; skipped: number }> {
    return parseOrThrow(await fetch(`/api/whatsapp/campaigns/${id}/send`, { method: "POST" }));
  },
  async cancel(id: string): Promise<{ success: boolean; cancelledJobs: number }> {
    return parseOrThrow(await fetch(`/api/whatsapp/campaigns/${id}/cancel`, { method: "POST" }));
  },
  async retryFailed(id: string): Promise<{ success: boolean; retried: number }> {
    return parseOrThrow(await fetch(`/api/whatsapp/campaigns/${id}/retry-failed`, { method: "POST" }));
  },
  async jobs(id: string, params: { status?: string; page?: number; pageSize?: number } = {}): Promise<{ data: WhatsAppMessageJobRecord[]; total: number; campaign: { status: string; sentCount: number; failedCount: number; totalRecipients: number } }> {
    return parseOrThrow(await fetch(`/api/whatsapp/campaigns/${id}/jobs?${toQuery(params)}`));
  },
  async retryJob(id: string, jobId: string): Promise<{ success: boolean }> {
    return parseOrThrow(await fetch(`/api/whatsapp/campaigns/${id}/jobs/${jobId}/retry`, { method: "POST" }));
  },
};
