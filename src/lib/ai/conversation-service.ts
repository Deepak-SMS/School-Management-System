import { prisma } from "@/lib/db";
import type { AiChatMessage } from "@/lib/ai/providers/types";

/** A conversationId was given that doesn't exist, or doesn't belong to this school+user. */
export class AiConversationNotFoundError extends Error {
  constructor() {
    super("Conversation not found.");
    this.name = "AiConversationNotFoundError";
  }
}

/** `regenerate: true` was sent for a conversation with no prior user message to regenerate from. */
export class AiNothingToRegenerateError extends Error {
  constructor() {
    super("There's nothing to regenerate yet — send a message first.");
    this.name = "AiNothingToRegenerateError";
  }
}

function deriveTitle(message: string): string {
  const trimmed = message.trim().replace(/\s+/g, " ");
  return trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed || "New conversation";
}

export async function listConversations(schoolId: string, userId: string) {
  return prisma.aiConversation.findMany({
    where: { schoolId, userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });
}

/** Throws AiConversationNotFoundError rather than returning null — every caller needs the same guard, so it lives here once. */
export async function getOwnedConversation(schoolId: string, userId: string, conversationId: string) {
  const conversation = await prisma.aiConversation.findFirst({ where: { id: conversationId, schoolId, userId } });
  if (!conversation) throw new AiConversationNotFoundError();
  return conversation;
}

export async function getConversationWithMessages(schoolId: string, userId: string, conversationId: string) {
  const conversation = await getOwnedConversation(schoolId, userId, conversationId);
  const messages = await prisma.aiMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, content: true, createdAt: true },
  });
  return { ...conversation, messages };
}

export async function createConversation(schoolId: string, userId: string, firstMessage: string) {
  return prisma.aiConversation.create({
    data: { schoolId, userId, title: deriveTitle(firstMessage) },
  });
}

export async function deleteConversation(schoolId: string, userId: string, conversationId: string): Promise<void> {
  await getOwnedConversation(schoolId, userId, conversationId);
  await prisma.aiConversation.delete({ where: { id: conversationId } });
}

export async function appendMessage(
  conversationId: string,
  schoolId: string,
  role: "user" | "assistant",
  content: string,
) {
  const [message] = await prisma.$transaction([
    prisma.aiMessage.create({ data: { conversationId, schoolId, role, content } }),
    prisma.aiConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
  ]);
  return message;
}

/** Recent turns for this conversation, oldest first, ready to hand to the provider as chat history. */
export async function getRecentMessages(conversationId: string, limit: number): Promise<AiChatMessage[]> {
  const rows = await prisma.aiMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { role: true, content: true },
  });
  return rows.reverse().map((r) => ({ role: r.role as AiChatMessage["role"], content: r.content }));
}

/**
 * Drops the trailing assistant reply (if any) after the last user message and
 * returns that user message's content, so the caller can regenerate a fresh
 * answer for it without inserting a duplicate user turn.
 */
export async function prepareRegenerate(schoolId: string, userId: string, conversationId: string): Promise<string> {
  await getOwnedConversation(schoolId, userId, conversationId);
  const messages = await prisma.aiMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, content: true },
  });

  let lastUserIndex = -1;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === "user") {
      lastUserIndex = i;
      break;
    }
  }
  if (lastUserIndex === -1) throw new AiNothingToRegenerateError();

  const trailingIds = messages.slice(lastUserIndex + 1).map((m) => m.id);
  if (trailingIds.length > 0) {
    await prisma.aiMessage.deleteMany({ where: { id: { in: trailingIds } } });
  }
  return messages[lastUserIndex].content;
}
