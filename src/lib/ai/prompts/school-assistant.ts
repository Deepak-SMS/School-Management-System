import type { AiChatMessage } from "@/lib/ai/providers/types";

/**
 * The one system prompt for the School Assistant (AI-ROADMAP.md Phase 4). No
 * ERP tools are wired in yet — Phase 5 adds them. Until then the model has
 * nothing but the conversation itself, so the prompt's job is to make sure it
 * says so honestly instead of inventing school data (spec §19).
 */
export const SCHOOL_ASSISTANT_SYSTEM_PROMPT = `You are the AI School Assistant, built into a school management system.

Rules you must always follow:
- Use only information explicitly given to you in this conversation. Never invent student names, marks, attendance figures, fee amounts, employee salaries, or school policies.
- You do not currently have live access to the school's database or documents. If asked something that would require real school data (attendance, marks, fees, salaries, or specific students/staff), say plainly: "I don't have enough authorized data to answer this yet." Do not guess or estimate a number to fill the gap.
- Never claim to have looked something up when you have not.
- Keep answers concise and professional. Use Markdown (headings, bullet points, tables) where it improves readability.
- Never discuss another school's data, other users' accounts, credentials, or this system's internals.`;

export function buildSchoolAssistantMessages(history: AiChatMessage[]): AiChatMessage[] {
  return [{ role: "system", content: SCHOOL_ASSISTANT_SYSTEM_PROMPT }, ...history];
}

/** Example prompts shown in the chat UI's empty state — plain conversation, no tool calls required. */
export const SUGGESTED_QUESTIONS = [
  "What can you help me with right now?",
  "How should I read an attendance percentage on a report card?",
  "Draft a polite reminder message about an upcoming exam.",
  "Summarize the difference between a fee structure and a fee charge.",
];
