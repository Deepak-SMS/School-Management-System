import { aiConfig } from "@/lib/ai/config";
import { ollamaProvider } from "@/lib/ai/providers/ollama-provider";
import { omniRouteProvider } from "@/lib/ai/providers/omniroute-provider";
import type { AiProvider } from "@/lib/ai/providers/types";

/**
 * The active provider, chosen by AI_PROVIDER ("ollama" — default, fully
 * local — or "omniroute", see omniroute-provider.ts for what that trades
 * away). Adding OpenAI/Claude/Gemini later is the same shape: a new provider
 * file plus a branch here — nothing that imports `aiProvider` needs to
 * change, same seam src/lib/storage.ts uses for local-disk-vs-S3.
 */
export const aiProvider: AiProvider = aiConfig.provider === "omniroute" ? omniRouteProvider : ollamaProvider;

export * from "@/lib/ai/providers/types";
