import type { ApiError } from "@/services/studentService";

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

export interface WhatsAppQrCode {
  dataUrl: string;
  expiresAt: string;
}

export interface WhatsAppAccountStatus {
  status: "disconnected" | "connecting" | "connected" | "logged_out" | "expired";
  phoneNumber: string | null;
  displayName: string | null;
  connectedAt: string | null;
  provider: string;
  isSimulated: boolean;
  qrCode: WhatsAppQrCode | null;
  dailyMessageCount: number;
}

export const whatsappAccountService = {
  async get(): Promise<WhatsAppAccountStatus> {
    return parseOrThrow(await fetch("/api/whatsapp/account"));
  },
  async connect(): Promise<WhatsAppQrCode> {
    return parseOrThrow(await fetch("/api/whatsapp/account/connect", { method: "POST" }));
  },
  async disconnect(): Promise<{ success: boolean }> {
    return parseOrThrow(await fetch("/api/whatsapp/account/disconnect", { method: "POST" }));
  },
  async logout(): Promise<{ success: boolean }> {
    return parseOrThrow(await fetch("/api/whatsapp/account/logout", { method: "POST" }));
  },
  async simulateScan(): Promise<{ success: boolean }> {
    return parseOrThrow(await fetch("/api/whatsapp/account/simulate-scan", { method: "POST" }));
  },
};
