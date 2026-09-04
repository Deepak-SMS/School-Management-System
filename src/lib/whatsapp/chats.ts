import { prisma } from "@/lib/db";

export interface RecordChatMessageInput {
  schoolId: string;
  /** Already-normalized E.164 form. */
  phoneE164: string;
  /** Best-known display name — used to create a new chat, and to refresh an existing one's name (e.g. WhatsApp's pushName can change). Omit to leave the existing name alone. */
  name?: string;
  /** Real WhatsApp profile picture URL — only used when creating a new chat (see chatNeedsAvatarFetch below); an existing chat's avatar is never overwritten here. */
  avatarUrl?: string;
  direction: "in" | "out";
  /** text | image | video | audio | document | sticker | location | contact | other — see WhatsAppChatMessage.messageType. */
  messageType?: string;
  text: string;
  providerMessageId?: string;
  sentAt?: Date;
  /** False for messages arriving as WhatsApp's own history-sync backfill on connect — a conversation that already existed on the phone shouldn't show up as freshly unread. Defaults true (a genuinely live message). */
  countsAsUnread?: boolean;
}

/** Read-only check the caller (baileys-provider.ts) uses before deciding whether it's worth an extra network call to fetch a profile picture — only a genuinely new chat needs one. */
export async function chatNeedsAvatarFetch(schoolId: string, phoneE164: string): Promise<boolean> {
  const chat = await prisma.whatsAppChat.findUnique({ where: { schoolId_phoneE164: { schoolId, phoneE164 } }, select: { avatarUrl: true } });
  return !chat || !chat.avatarUrl;
}

/**
 * Records one message into the real WhatsApp chat thread with a phone
 * number — the actual conversation, distinct from WhatsAppMessageJob (the
 * campaign-send log). Called for both directions from one place
 * (src/lib/whatsapp/baileys-provider.ts's messages.upsert handler, which
 * Baileys fires for outbound sends too via emitOwnEvents, and for its
 * history-sync backfill on every fresh connection) so a reply and the
 * message it replies to land in the same thread without double-recording.
 */
export async function recordChatMessage(input: RecordChatMessageInput): Promise<void> {
  const sentAt = input.sentAt ?? new Date();
  const preview = input.text.length > 200 ? `${input.text.slice(0, 200)}…` : input.text;
  const countsAsUnread = (input.countsAsUnread ?? true) && input.direction === "in";

  // Idempotent: a reconnect replays recent history, and Baileys can otherwise
  // redeliver a message — WhatsApp's own message id is stable, so a message
  // already recorded is skipped rather than growing duplicate thread entries.
  if (input.providerMessageId) {
    const existing = await prisma.whatsAppChatMessage.findFirst({
      where: { schoolId: input.schoolId, providerMessageId: input.providerMessageId },
      select: { id: true },
    });
    if (existing) return;
  }

  const existingChat = await prisma.whatsAppChat.findUnique({ where: { schoolId_phoneE164: { schoolId: input.schoolId, phoneE164: input.phoneE164 } } });
  // History backfill can arrive out of order relative to what's already
  // stored — only let it overwrite the "last message" summary if it's
  // actually the newest thing this chat has seen.
  const isNewest = !existingChat?.lastMessageAt || sentAt >= existingChat.lastMessageAt;

  const chat = await prisma.whatsAppChat.upsert({
    where: { schoolId_phoneE164: { schoolId: input.schoolId, phoneE164: input.phoneE164 } },
    create: {
      schoolId: input.schoolId,
      phoneE164: input.phoneE164,
      name: input.name || input.phoneE164,
      avatarUrl: input.avatarUrl,
      lastMessageAt: sentAt,
      lastMessagePreview: preview,
      lastMessageFromMe: input.direction === "out",
      unreadCount: countsAsUnread ? 1 : 0,
    },
    update: {
      ...(input.name ? { name: input.name } : {}),
      ...(isNewest ? { lastMessageAt: sentAt, lastMessagePreview: preview, lastMessageFromMe: input.direction === "out" } : {}),
      ...(countsAsUnread ? { unreadCount: { increment: 1 } } : {}),
    },
  });

  await prisma.whatsAppChatMessage.create({
    data: {
      schoolId: input.schoolId,
      chatId: chat.id,
      direction: input.direction,
      messageType: input.messageType || "text",
      text: input.text,
      status: input.direction === "out" ? "sent" : null,
      providerMessageId: input.providerMessageId,
      sentAt,
    },
  });

  if (!chat.contactId) {
    const contact = await prisma.whatsAppContact.findUnique({ where: { schoolId_phoneE164: { schoolId: input.schoolId, phoneE164: input.phoneE164 } } });
    if (contact) await prisma.whatsAppChat.update({ where: { id: chat.id }, data: { contactId: contact.id } });
  }
}

/** Applies a delivery-status ack (see baileys-provider.ts's messages.update handler) to the matching outbound message, if it's still recorded. */
export async function updateChatMessageStatus(schoolId: string, providerMessageId: string, status: string): Promise<void> {
  await prisma.whatsAppChatMessage.updateMany({ where: { schoolId, providerMessageId }, data: { status } });
}
