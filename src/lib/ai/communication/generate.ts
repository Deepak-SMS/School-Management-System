import { aiProvider } from "@/lib/ai/providers";
import { COMMUNICATION_TYPES, type CommunicationTone, type CommunicationType } from "@/lib/ai/communication/templates";

export interface GenerateCommunicationInput {
  type: CommunicationType;
  tone: CommunicationTone;
  language: string;
  /** What the sender typed — the human-provided intent/details. */
  context: string;
  /** Real, backend-resolved facts about the audience (counts, names) — see resolveAudience(). Never LLM-invented. */
  audiencePromptContext: string;
}

const SYSTEM_PROMPT =
  "You are the AI Communication Assistant inside a school management system. " +
  "You draft one message at a time for school staff to review before sending. " +
  "Use ONLY the facts given to you — never invent a student name, date, amount, or statistic that wasn't provided. " +
  "If the sender's context doesn't give you a specific detail (e.g. an exact date), write around it generically rather than making one up. " +
  "Output only the message itself — no preamble like 'Here is a draft', no explanation, no markdown headings. " +
  "Write a subject line as the first line prefixed with 'Subject: ', then a blank line, then the message body.";

export async function generateCommunicationDraft(input: GenerateCommunicationInput): Promise<string> {
  const typeInfo = COMMUNICATION_TYPES.find((t) => t.value === input.type);
  const userPrompt = `Communication type: ${typeInfo?.label ?? input.type} — ${typeInfo?.hint ?? ""}
Tone: ${input.tone}
Language: ${input.language}
${input.audiencePromptContext ? `Real audience context (use these facts if relevant, do not add to them): ${input.audiencePromptContext}\n` : ""}Sender's instructions: ${input.context || "(no additional context given — write a generic, appropriate message for this type)"}`;

  let text = "";
  for await (const chunk of aiProvider.chatStream([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ])) {
    text += chunk.content;
  }
  return text.trim();
}

/** Splits a "Subject: ...\n\nBody..." draft into parts for the UI/send flow. Falls back gracefully if the model didn't include a subject line. */
export function splitDraft(draft: string): { subject: string; body: string } {
  const match = draft.match(/^Subject:\s*(.+?)\r?\n\r?\n([\s\S]*)$/i);
  if (match) return { subject: match[1].trim(), body: match[2].trim() };
  return { subject: "", body: draft.trim() };
}
