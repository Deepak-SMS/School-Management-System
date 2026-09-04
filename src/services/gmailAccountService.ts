import type { ApiError } from "@/services/studentService";

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

export interface GmailStatus {
  connected: boolean;
  email: string | null;
  status: "connected" | "disconnected" | "reauth_required" | "error";
  lastError: string | null;
  configured: boolean;
  dailyMessageCount: number;
  connectedAt: string | null;
}

export const gmailAccountService = {
  async get(): Promise<GmailStatus> {
    return parseOrThrow(await fetch("/api/email/gmail/status"));
  },
  /** Navigates the whole page to Google's consent screen — not a fetch, a real redirect. */
  connect(): void {
    window.location.href = "/api/email/gmail/connect";
  },
  async disconnect(): Promise<{ success: boolean }> {
    return parseOrThrow(await fetch("/api/email/gmail/disconnect", { method: "POST" }));
  },
  async test(): Promise<{ ok: boolean; error?: string }> {
    return parseOrThrow(await fetch("/api/email/gmail/test", { method: "POST" }));
  },
};
