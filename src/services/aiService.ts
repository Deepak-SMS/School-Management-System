import type { AiConversationDetail, AiConversationSummary, AiHealthStatus, AiStreamEvent } from "@/types/ai";
import type { ApiError } from "@/services/studentService";

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) throw body as ApiError;
  return body as T;
}

interface StreamChatInput {
  conversationId?: string;
  message?: string;
  regenerate?: boolean;
}

interface StreamChatHandlers {
  onStart?: (conversationId: string) => void;
  onChunk: (content: string) => void;
  onError?: (message: string) => void;
  onDone?: (status: "success" | "error" | "stopped") => void;
}

export const aiService = {
  async listConversations(): Promise<AiConversationSummary[]> {
    const response = await fetch("/api/ai/conversations");
    const body = await parseOrThrow<{ data: AiConversationSummary[] }>(response);
    return body.data;
  },

  async getConversation(id: string): Promise<AiConversationDetail> {
    const response = await fetch(`/api/ai/conversations/${id}`);
    return parseOrThrow<AiConversationDetail>(response);
  },

  async deleteConversation(id: string): Promise<void> {
    const response = await fetch(`/api/ai/conversations/${id}`, { method: "DELETE" });
    await parseOrThrow(response);
  },

  async health(): Promise<AiHealthStatus> {
    const response = await fetch("/api/ai/health");
    return parseOrThrow<AiHealthStatus>(response);
  },

  /** Posts a chat turn and reads back the newline-delimited JSON event stream — see src/app/api/ai/chat/route.ts. */
  async streamChat(input: StreamChatInput, handlers: StreamChatHandlers, signal?: AbortSignal): Promise<void> {
    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal,
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({ error: "Something went wrong." }))) as ApiError;
      handlers.onError?.(body.error ?? "Something went wrong.");
      return;
    }
    if (!response.body) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line) as AiStreamEvent;
        if (event.type === "start") handlers.onStart?.(event.conversationId);
        else if (event.type === "chunk") handlers.onChunk(event.content);
        else if (event.type === "error") handlers.onError?.(event.message);
        else if (event.type === "done") handlers.onDone?.(event.status);
      }
    }
  },
};
