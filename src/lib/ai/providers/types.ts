/**
 * Provider abstraction. Ollama is the only implementation today, but nothing
 * in the orchestrator/route layer imports OllamaProvider directly — everyone
 * codes against AiProvider, so OpenAI/Claude/Gemini providers can be added
 * later (AI-ROADMAP.md §5) as another file in this folder plus one line at
 * the bottom of this file wiring it in.
 */

export interface AiChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiChatChunk {
  content: string;
  done: boolean;
}

export interface AiHealthStatus {
  connected: boolean;
  model: string;
  modelAvailable: boolean;
  responseTimeMs: number | null;
  error?: string;
}

export interface AiProvider {
  readonly name: string;
  /** Streams the assistant's reply chunk by chunk. `signal` aborts the underlying request (stop generation / client disconnect). */
  chatStream(messages: AiChatMessage[], signal?: AbortSignal): AsyncGenerator<AiChatChunk>;
  health(): Promise<AiHealthStatus>;
}

/** Thrown when the provider can't be reached at all — offline, wrong port, not installed. */
export class AiProviderUnavailableError extends Error {
  constructor(message = "Ollama is currently unavailable. Please make sure the local AI service is running.") {
    super(message);
    this.name = "AiProviderUnavailableError";
  }
}
