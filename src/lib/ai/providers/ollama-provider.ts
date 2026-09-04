import { aiConfig } from "@/lib/ai/config";
import { AiProviderUnavailableError, type AiChatChunk, type AiChatMessage, type AiHealthStatus, type AiProvider } from "@/lib/ai/providers/types";

interface OllamaChatLine {
  message?: { role: string; content: string };
  done?: boolean;
}

interface OllamaTagsResponse {
  models?: { name: string }[];
}

/**
 * Talks to a local Ollama instance over its HTTP API. Never imported by the
 * frontend — only src/app/api/ai/* routes and src/lib/ai/* reach this file
 * (AI-ROADMAP.md §5, "never expose Ollama directly to the browser").
 */
export class OllamaProvider implements AiProvider {
  readonly name = "ollama";

  async *chatStream(messages: AiChatMessage[], signal?: AbortSignal): AsyncGenerator<AiChatChunk> {
    const timeoutController = new AbortController();
    const timeout = setTimeout(() => timeoutController.abort(), aiConfig.requestTimeoutMs);
    const combinedSignal = signal ? AbortSignal.any([signal, timeoutController.signal]) : timeoutController.signal;

    let response: Response;
    try {
      response = await fetch(`${aiConfig.ollamaBaseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: aiConfig.ollamaModel, messages, stream: true }),
        signal: combinedSignal,
      });
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === "AbortError" && signal?.aborted) throw error;
      throw new AiProviderUnavailableError();
    }

    if (!response.ok || !response.body) {
      clearTimeout(timeout);
      throw new AiProviderUnavailableError(
        response.status === 404
          ? `Model "${aiConfig.ollamaModel}" is not available on this Ollama instance. Pull it with "ollama pull ${aiConfig.ollamaModel}".`
          : `Ollama returned an error (${response.status}).`,
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const parsed = JSON.parse(line) as OllamaChatLine;
          yield { content: parsed.message?.content ?? "", done: Boolean(parsed.done) };
        }
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  async health(): Promise<AiHealthStatus> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), aiConfig.healthTimeoutMs);
    try {
      const response = await fetch(`${aiConfig.ollamaBaseUrl}/api/tags`, { signal: controller.signal });
      const responseTimeMs = Date.now() - startedAt;
      if (!response.ok) {
        return { connected: false, model: aiConfig.ollamaModel, modelAvailable: false, responseTimeMs, error: `Ollama returned ${response.status}.` };
      }
      const body = (await response.json()) as OllamaTagsResponse;
      const models = body.models ?? [];
      const modelAvailable = models.some((m) => m.name === aiConfig.ollamaModel || m.name.startsWith(`${aiConfig.ollamaModel}:`));
      return { connected: true, model: aiConfig.ollamaModel, modelAvailable, responseTimeMs };
    } catch {
      return {
        connected: false,
        model: aiConfig.ollamaModel,
        modelAvailable: false,
        responseTimeMs: null,
        error: "Ollama is currently unavailable. Please make sure the local AI service is running.",
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const ollamaProvider: AiProvider = new OllamaProvider();
