/**
 * Central AI configuration — env vars in one place, same shape as the
 * UploadKind constants in src/lib/storage.ts. Nothing outside this file
 * should read process.env.OLLAMA_ or OMNIROUTE_ vars directly, and no model
 * name should be hardcoded elsewhere (see AI-ROADMAP.md section 5).
 */
const provider = process.env.AI_PROVIDER === "omniroute" ? "omniroute" : "ollama";
const ollamaModel = process.env.OLLAMA_MODEL ?? "llama3.2";
const omniRouteModel = process.env.OMNIROUTE_MODEL ?? "auto";

export const aiConfig = {
  /**
   * Which AiProvider src/lib/ai/providers/index.ts hands out. "ollama"
   * (default) is local-only and never leaves this machine; "omniroute"
   * routes to whatever third-party providers OmniRoute itself is configured
   * with — see the privacy/ToS note on OmniRouteProvider before switching a
   * real school's data over to it.
   */
  provider,
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  ollamaModel,
  embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text",
  omniRouteBaseUrl: process.env.OMNIROUTE_BASE_URL ?? "http://localhost:20128/v1",
  /** Optional — OmniRoute's zero-config free tier works without one. Required once you attach paid/quota'd providers. */
  omniRouteApiKey: process.env.OMNIROUTE_API_KEY ?? "",
  omniRouteModel,
  /** The active provider's model name — every AiRequest/AiUsage row logs this, regardless of which provider is selected. */
  model: provider === "omniroute" ? omniRouteModel : ollamaModel,
  /** Aborts a chat request if the model has produced nothing at all in this long. */
  requestTimeoutMs: 60_000,
  /** Health checks must stay snappy — this feeds a UI status badge, not a chat reply. */
  healthTimeoutMs: 5_000,
  /**
   * Requests per calendar month, per user. Flat and hardcoded because no
   * subscription/plan model exists yet to hang a per-tier quota off — see
   * AI-ROADMAP.md §2 and §10. Revisit once one does.
   */
  defaultMonthlyQuota: 500,
} as const;
