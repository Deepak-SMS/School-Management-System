import type { ApiError } from "@/services/studentService";
import type { WhatsAppMessageJobRecord } from "@/services/whatsappCampaignService";

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

export interface WhatsAppMessageSearchParams {
  q?: string;
  status?: string;
  campaignId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export type WhatsAppMessageRecord = WhatsAppMessageJobRecord & { campaignId: string; campaign?: { name: string } | null };

export const whatsappMessageService = {
  async search(params: WhatsAppMessageSearchParams = {}): Promise<{ data: WhatsAppMessageRecord[]; total: number }> {
    return parseOrThrow(await fetch(`/api/whatsapp/messages?${toQuery(params as Record<string, unknown>)}`));
  },
};
