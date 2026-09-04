import { aiProvider, AiProviderUnavailableError } from "@/lib/ai/providers";

/**
 * Turns already-computed, real statistics into a short plain-language
 * narrative. This is the one place Ollama is allowed to touch numbers — and
 * even then only to *describe* ones it's handed, never to invent or recompute
 * them (spec §7/§19: "Do not allow the AI to invent numerical values").
 *
 * Non-streaming: analytics/reports/communication return a complete JSON
 * response, unlike the chat endpoint which streams token-by-token.
 */
export async function narrateStats(instructions: string, stats: unknown, signal?: AbortSignal): Promise<string> {
  const systemPrompt =
    "You are narrating real, already-computed statistics for a school management system. " +
    "Use ONLY the numbers in the JSON you are given — never invent, estimate, or infer a number that isn't present. " +
    "Do not mention 'the JSON' or 'the data provided'; write as a confident analyst describing real results. " +
    "Plain prose, no markdown headings, no code fences.";

  const userPrompt = `${instructions}\n\nStatistics:\n${JSON.stringify(stats)}`;

  let text = "";
  for await (const chunk of aiProvider.chatStream(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    signal,
  )) {
    text += chunk.content;
  }
  return text.trim();
}

export interface ReportSections {
  executiveSummary: string;
  observations: string;
  areasOfConcern: string;
  recommendations: string;
  conclusion: string;
  narrativeError?: string;
}

const SECTION_KEYS: Record<string, keyof Omit<ReportSections, "narrativeError">> = {
  "executive summary": "executiveSummary",
  observations: "observations",
  "areas of concern": "areasOfConcern",
  recommendations: "recommendations",
  conclusion: "conclusion",
};

function parseReportSections(raw: string): Omit<ReportSections, "narrativeError"> {
  const result = { executiveSummary: "", observations: "", areasOfConcern: "", recommendations: "", conclusion: "" };
  const parts = raw.split(/^##\s+/m).filter(Boolean);
  for (const part of parts) {
    const newlineIndex = part.indexOf("\n");
    const headerLine = newlineIndex === -1 ? part : part.slice(0, newlineIndex);
    const body = newlineIndex === -1 ? "" : part.slice(newlineIndex + 1);
    const key = SECTION_KEYS[headerLine.trim().toLowerCase()];
    if (key) result[key] = body.trim();
  }
  // The local model didn't follow the requested format — surface what it said rather than showing a blank report.
  if (!Object.values(result).some(Boolean) && raw.trim()) result.executiveSummary = raw.trim();
  return result;
}

/** Same "only describe real numbers" contract as narrateStats(), but structured into the five sections every AI Report needs (spec §8). */
export async function generateReportSections(reportTitle: string, stats: unknown, extraInstruction: string): Promise<ReportSections> {
  const instructions = `Write a professional report narrative for a "${reportTitle}" using ONLY the statistics given below — never invent a figure that isn't present. ${extraInstruction}

Respond in exactly this format, with each header on its own line exactly as shown (including the "##"):

## Executive Summary
2-3 sentences summarizing the period's results.

## Observations
2-4 sentences or "-" bullet points on what the numbers show.

## Areas of Concern
1-3 sentences or bullets. If nothing in the numbers is concerning, say so explicitly rather than inventing a concern.

## Recommendations
2-4 actionable "-" bullet points.

## Conclusion
1-2 closing sentences.`;

  try {
    const raw = await narrateStats(instructions, stats);
    return parseReportSections(raw);
  } catch (error) {
    const narrativeError = error instanceof AiProviderUnavailableError ? error.message : "The AI narrative couldn't be generated. The statistics in this report are still accurate.";
    return { executiveSummary: "", observations: "", areasOfConcern: "", recommendations: "", conclusion: "", narrativeError };
  }
}
