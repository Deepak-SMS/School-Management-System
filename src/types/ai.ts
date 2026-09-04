export interface AiConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export type AiMessageRole = "user" | "assistant" | "system";

export interface AiMessageRecord {
  id: string;
  role: AiMessageRole;
  content: string;
  createdAt: string;
}

export interface AiConversationDetail extends AiConversationSummary {
  messages: AiMessageRecord[];
}

export interface AiHealthStatus {
  connected: boolean;
  model: string;
  modelAvailable: boolean;
  responseTimeMs: number | null;
  error?: string;
}

export type AiStreamEvent =
  | { type: "start"; conversationId: string }
  | { type: "chunk"; content: string }
  | { type: "error"; message: string }
  | { type: "done"; responseTimeMs: number; status: "success" | "error" | "stopped" };
