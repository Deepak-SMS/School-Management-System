import type { CommunicationTone, CommunicationType } from "@/lib/ai/communication/templates";
import type { AudienceMode } from "@/lib/ai/communication/audience-modes";
import type { ApiError } from "@/services/studentService";

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

interface AudienceParams {
  audienceMode: AudienceMode;
  classId?: string;
  sectionId?: string;
  thresholdPct?: number;
}

export interface GenerateCommunicationInput extends AudienceParams {
  type: CommunicationType;
  tone: CommunicationTone;
  language: string;
  context: string;
}

export interface GenerateCommunicationResult {
  subject: string;
  body: string;
  audience: { label: string; recipientCount: number; missingEmailCount: number };
}

export interface SendCommunicationInput extends AudienceParams {
  subject: string;
  body: string;
}

export interface SendCommunicationResult {
  inAppSent: boolean;
  emailsSent: number;
  emailsSkipped: number;
  emailConfigured: boolean;
  audienceLabel: string;
}

export const aiCommunicationService = {
  async generate(input: GenerateCommunicationInput): Promise<GenerateCommunicationResult> {
    const response = await fetch("/api/ai/communication/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<GenerateCommunicationResult>(response);
  },

  async send(input: SendCommunicationInput): Promise<SendCommunicationResult> {
    const response = await fetch("/api/ai/communication/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return parseOrThrow<SendCommunicationResult>(response);
  },
};
