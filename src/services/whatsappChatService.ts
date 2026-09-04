import type { ApiError } from "@/services/studentService";

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

export interface WhatsAppChatRecord {
  id: string;
  phoneE164: string;
  name: string;
  avatarUrl: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastMessageFromMe: boolean;
  unreadCount: number;
}

export interface WhatsAppChatMessageRecord {
  id: string;
  direction: "in" | "out";
  messageType: string;
  text: string;
  status: string | null;
  sentAt: string;
}

export const whatsappChatService = {
  async list(q?: string): Promise<{ data: WhatsAppChatRecord[]; total: number }> {
    return parseOrThrow(await fetch(`/api/whatsapp/chats${q ? `?q=${encodeURIComponent(q)}` : ""}`));
  },
  async messages(chatId: string): Promise<{ chat: WhatsAppChatRecord; messages: WhatsAppChatMessageRecord[] }> {
    return parseOrThrow(await fetch(`/api/whatsapp/chats/${chatId}/messages`));
  },
  async send(chatId: string, text: string): Promise<{ success: boolean }> {
    return parseOrThrow(await fetch(`/api/whatsapp/chats/${chatId}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) }));
  },
  async markRead(chatId: string): Promise<{ success: boolean }> {
    return parseOrThrow(await fetch(`/api/whatsapp/chats/${chatId}/read`, { method: "POST" }));
  },
};
