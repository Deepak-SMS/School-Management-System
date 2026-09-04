import type { ApiError } from "@/services/studentService";
import type { EmailRecipientType } from "@/lib/email-campaigns/recipient-types";

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

export interface EmailCampaignRecord {
  id: string;
  name: string;
  templateId: string | null;
  template?: { name: string } | null;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  recipientType: string;
  audienceFilterJson: string | null;
  status: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  cancelledCount: number;
  skippedCount: number;
  invalidCount: number;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

export interface EmailCampaignInput {
  name: string;
  templateId?: string;
  subject: string;
  bodyHtml: string;
  recipientType: EmailRecipientType;
  studentIds?: string[];
  classIds?: string[];
  sectionIds?: string[];
  minPendingAmount?: number;
  importedRows?: { name: string; email: string; customFields: Record<string, string> }[];
}

export interface EmailAudiencePreviewRow {
  studentName: string | null;
  guardianName: string;
  email: string | null;
  className: string | null;
  sectionName: string | null;
  pendingFees: string | null;
}

export interface EmailAudiencePreview {
  label: string;
  total: number;
  missingEmailCount: number;
  sample: EmailAudiencePreviewRow[];
  truncated: boolean;
}

export interface EmailCampaignValidateResult {
  totalRecipients: number;
  sendableCount: number;
  invalidEmailCount: number;
  missingVariableCount: number;
  missingVariableSample: { recipientName: string; missingVariables: string[] }[];
}

export interface EmailJobRecord {
  id: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  status: string;
  attempts: number;
  lastError: string | null;
  lastErrorType: string | null;
  sentAt: string | null;
  queuedAt: string;
}

export const emailCampaignService = {
  async list(params: { status?: string } = {}): Promise<{ data: EmailCampaignRecord[]; total: number }> {
    return parseOrThrow(await fetch(`/api/email/campaigns?${toQuery(params)}`));
  },
  async get(id: string): Promise<EmailCampaignRecord> {
    return parseOrThrow(await fetch(`/api/email/campaigns/${id}`));
  },
  async create(input: EmailCampaignInput): Promise<EmailCampaignRecord & { audienceLabel: string }> {
    return parseOrThrow(await fetch("/api/email/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }));
  },
  async update(id: string, input: Partial<EmailCampaignInput>): Promise<EmailCampaignRecord> {
    return parseOrThrow(await fetch(`/api/email/campaigns/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }));
  },
  async remove(id: string): Promise<{ success: boolean }> {
    return parseOrThrow(await fetch(`/api/email/campaigns/${id}`, { method: "DELETE" }));
  },
  async previewAudience(input: Omit<EmailCampaignInput, "name" | "subject" | "bodyHtml" | "templateId" | "importedRows">): Promise<EmailAudiencePreview> {
    return parseOrThrow(await fetch("/api/email/campaigns/preview-audience", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }));
  },
  async validate(id: string): Promise<EmailCampaignValidateResult> {
    return parseOrThrow(await fetch(`/api/email/campaigns/${id}/validate`, { method: "POST" }));
  },
  async sendTest(id: string, to: string, studentId?: string): Promise<{ success: boolean }> {
    return parseOrThrow(await fetch(`/api/email/campaigns/${id}/test`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to, studentId }) }));
  },
  async start(id: string): Promise<{ success: boolean; total: number; pending: number; invalid: number; skipped: number }> {
    return parseOrThrow(await fetch(`/api/email/campaigns/${id}/start`, { method: "POST" }));
  },
  async schedule(id: string, scheduledAt: string): Promise<{ success: boolean }> {
    return parseOrThrow(await fetch(`/api/email/campaigns/${id}/schedule`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scheduledAt }) }));
  },
  async cancel(id: string): Promise<{ success: boolean; cancelledJobs: number; alreadySent: number }> {
    return parseOrThrow(await fetch(`/api/email/campaigns/${id}/cancel`, { method: "POST" }));
  },
  async retryFailed(id: string): Promise<{ success: boolean; retried: number }> {
    return parseOrThrow(await fetch(`/api/email/campaigns/${id}/retry-failed`, { method: "POST" }));
  },
  async jobs(id: string, params: { status?: string; page?: number; pageSize?: number } = {}): Promise<{ data: EmailJobRecord[]; total: number; campaign: { status: string; sentCount: number; failedCount: number; totalRecipients: number } }> {
    return parseOrThrow(await fetch(`/api/email/campaigns/${id}/jobs?${toQuery(params)}`));
  },
  async retryJob(id: string, jobId: string): Promise<{ success: boolean }> {
    return parseOrThrow(await fetch(`/api/email/campaigns/${id}/jobs/${jobId}/retry`, { method: "POST" }));
  },
};
