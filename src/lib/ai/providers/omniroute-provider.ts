import { aiConfig } from "@/lib/ai/config";
import { AiProviderUnavailableError, type AiChatChunk, type AiChatMessage, type AiHealthStatus, type AiProvider } from "@/lib/ai/providers/types";

interface OpenAiStreamChunk {
  choices?: { delta?: { content?: string }; finish_reason?: string | null }[];
}

interface OpenAiModelsResponse {
  data?: { id: string }[];
}

/**
 * Talks to a locally-running OmniRoute gateway (https://github.com/diegosouzapw/OmniRoute)
 * over its OpenAI-compatible API. OmniRoute itself then forwards the request
 * to whichever third-party provider it's configured with — unlike
 * OllamaProvider, this is NOT purely local: prompts leave this machine once
 * they reach whatever upstream OmniRoute picks. Before pointing a real
 * school's data at this (AI_PROVIDER=omniroute), read OmniRoute's own "Terms"
 * warning — some of its catalogued providers carry an explicit risk flag —
 * and treat the "free" tier as fine for local development/evaluation only.
 */
export class OmniRouteProvider implements AiProvider {
  readonly name = "omniroute";

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (aiConfig.omniRouteApiKey) headers.Authorization = `Bearer ${aiConfig.omniRouteApiKey}`;
    return headers;
  }

  async *chatStream(messages: AiChatMessage[], signal?: AbortSignal): AsyncGenerator<AiChatChunk> {
    const timeoutController = new AbortController();
    const timeout = setTimeout(() => timeoutController.abort(), aiConfig.requestTimeoutMs);
    const combinedSignal = signal ? AbortSignal.any([signal, timeoutController.signal]) : timeoutController.signal;

    let response: Response;
    try {
      response = await fetch(`${aiConfig.omniRouteBaseUrl}/chat/completions`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ model: aiConfig.omniRouteModel, messages, stream: true }),
        signal: combinedSignal,
      });
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === "AbortError" && signal?.aborted) throw error;
      throw new AiProviderUnavailableError("OmniRoute is currently unavailable. Please make sure the local OmniRoute gateway is running.");
    }

    if (!response.ok || !response.body) {
      clearTimeout(timeout);
      throw new AiProviderUnavailableError(`OmniRoute returned an error (${response.status}).`);
    }

    // OpenAI-style SSE: lines of `data: {...}`, terminated by `data: [DONE]`.
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
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") {
            yield { content: "", done: true };
            continue;
          }
          if (!data) continue;
          const parsed = JSON.parse(data) as OpenAiStreamChunk;
          const choice = parsed.choices?.[0];
          yield { content: choice?.delta?.content ?? "", done: Boolean(choice?.finish_reason) };
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
      const response = await fetch(`${aiConfig.omniRouteBaseUrl}/models`, { headers: this.headers(), signal: controller.signal });
      const responseTimeMs = Date.now() - startedAt;
      if (!response.ok) {
        return { connected: false, model: aiConfig.omniRouteModel, modelAvailable: false, responseTimeMs, error: `OmniRoute returned ${response.status}.` };
      }
      const body = (await response.json()) as OpenAiModelsResponse;
      const models = body.data ?? [];
      // "auto" and "auto/*" are OmniRoute's own routing aliases, not literal
      // model ids — always considered available since OmniRoute resolves them.
      const modelAvailable = aiConfig.omniRouteModel.startsWith("auto") || models.some((m) => m.id === aiConfig.omniRouteModel);
      return { connected: true, model: aiConfig.omniRouteModel, modelAvailable, responseTimeMs };
    } catch {
      return {
        connected: false,
        model: aiConfig.omniRouteModel,
        modelAvailable: false,
        responseTimeMs: null,
        error: "OmniRoute is currently unavailable. Please make sure the local OmniRoute gateway is running.",
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const omniRouteProvider: AiProvider = new OmniRouteProvider();
