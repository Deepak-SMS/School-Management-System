import { existsSync } from "fs";
import { rm } from "fs/promises";
import path from "path";
import { Boom } from "@hapi/boom";
import pino from "pino";
import QRCode from "qrcode";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  isJidGroup,
  isJidBroadcast,
  jidNormalizedUser,
  proto,
  type WASocket,
} from "baileys";
import { prisma } from "@/lib/db";
import {
  WhatsAppNotConnectedError,
  type WhatsAppAccountInfo,
  type WhatsAppConnectionStatus,
  type WhatsAppProvider,
  type WhatsAppQrCode,
  type WhatsAppSendResult,
} from "@/lib/whatsapp/provider";
import { recordChatMessage, chatNeedsAvatarFetch, updateChatMessageStatus } from "@/lib/whatsapp/chats";

/** Plain text if there is any, otherwise a readable placeholder for the media types this text-only inbox doesn't download/render — never silently dropped. */
function describeMessageContent(message: proto.IMessage): { text: string; messageType: string } | null {
  const plain = message.conversation || message.extendedTextMessage?.text;
  if (plain) return { text: plain, messageType: "text" };

  if (message.imageMessage) return { text: message.imageMessage.caption ? `📷 ${message.imageMessage.caption}` : "📷 Photo", messageType: "image" };
  if (message.videoMessage) return { text: message.videoMessage.caption ? `🎥 ${message.videoMessage.caption}` : "🎥 Video", messageType: "video" };
  if (message.audioMessage) return { text: message.audioMessage.ptt ? "🎤 Voice message" : "🎵 Audio", messageType: "audio" };
  if (message.documentMessage) return { text: `📄 ${message.documentMessage.fileName || "Document"}`, messageType: "document" };
  if (message.stickerMessage) return { text: "Sticker", messageType: "sticker" };
  if (message.locationMessage || message.liveLocationMessage) return { text: "📍 Location", messageType: "location" };
  if (message.contactMessage || message.contactsArrayMessage) return { text: "👤 Contact card", messageType: "contact" };

  return null; // protocol/reaction/other non-content stubs — genuinely nothing to show
}

const ACK_STATUS: Record<number, string> = {
  0: "failed",
  1: "pending",
  2: "sent",
  3: "delivered",
  4: "read",
  5: "read",
};

/**
 * A real WhatsApp Web connection via the unofficial `baileys` protocol
 * library — the same underlying mechanism as whatsapp-web.js, without
 * needing a headless Chromium (Baileys re-implements the WhatsApp Web
 * WebSocket protocol directly). This is NOT Meta's official WhatsApp
 * Business Platform; it automates a personal/business WhatsApp account the
 * way WhatsApp Web itself does, which is against WhatsApp's Terms of
 * Service and carries real risk of the linked number being rate-limited or
 * banned for bulk/automated sends. See WHATSAPP-ROADMAP.md.
 *
 * Requires a persistent Node process (true for `next start` here — a single
 * long-running server, no custom server, no serverless target today) since
 * the live WASocket is an in-memory, stateful WebSocket connection that
 * cannot be serialized between requests. Held in a globalThis-guarded map,
 * same survive-Fast-Refresh idiom src/lib/db.ts and worker.ts already use.
 */

declare global {
  var __baileysSockets: Map<string, WASocket> | undefined;
  var __baileysIntentionalClose: Set<string> | undefined;
}

function sockets(): Map<string, WASocket> {
  if (!globalThis.__baileysSockets) globalThis.__baileysSockets = new Map();
  return globalThis.__baileysSockets;
}

function intentionalCloses(): Set<string> {
  if (!globalThis.__baileysIntentionalClose) globalThis.__baileysIntentionalClose = new Set();
  return globalThis.__baileysIntentionalClose;
}

const AUTH_ROOT = path.join(process.cwd(), ".data", "whatsapp-auth");
const CONNECT_TIMEOUT_MS = 20_000;
const logger = pino({ level: process.env.WHATSAPP_BAILEYS_LOG_LEVEL ?? "error" });

function authDir(schoolId: string): string {
  return path.join(AUTH_ROOT, schoolId);
}

function jidFor(phoneE164: string): string {
  return `${phoneE164.replace(/^\+/, "")}@s.whatsapp.net`;
}

/**
 * WhatsApp has been migrating personal contacts from phone-number jids
 * (`@s.whatsapp.net`) to a newer "LID" identifier (`@lid`) that doesn't
 * embed the phone number at all — in practice, most of a real account's
 * contacts show up this way now. Baileys keeps a local LID<->phone-number
 * mapping (synced as part of connecting, cached under .data/whatsapp-auth)
 * that resolves this without a network round-trip; a LID WhatsApp hasn't
 * given us a mapping for yet resolves to null and that message is skipped
 * rather than shown under a meaningless identifier.
 */
async function resolvePhoneFromJid(sock: WASocket, jid: string): Promise<string | null> {
  const normalized = jidNormalizedUser(jid);
  if (normalized.endsWith("@s.whatsapp.net")) {
    return `+${normalized.split("@")[0]}`;
  }
  if (normalized.endsWith("@lid")) {
    try {
      const pn = await sock.signalRepository.lidMapping.getPNForLID(normalized);
      if (!pn) return null;
      const digits = pn.split("@")[0].split(":")[0].replace(/\D/g, "");
      return digits ? `+${digits}` : null;
    } catch {
      return null;
    }
  }
  return null;
}

async function upsertAccount(schoolId: string, data: Record<string, unknown>) {
  return prisma.whatsAppAccount.upsert({
    where: { schoolId },
    create: { schoolId, provider: "baileys", ...data },
    update: { provider: "baileys", ...data },
  });
}

/**
 * Creates (or recreates, on an unexpected drop) the live socket for a
 * school. Wires connection.update -> WhatsAppAccount so every other method
 * on this provider can stay a pure DB read, and creds.update -> disk so a
 * restart resumes without a new QR as long as WhatsApp hasn't invalidated
 * the linked device.
 */
async function startSocket(schoolId: string): Promise<WASocket> {
  const existing = sockets().get(schoolId);
  if (existing) return existing;

  const { state, saveCreds } = await useMultiFileAuthState(authDir(schoolId));
  const sock = makeWASocket({
    auth: state,
    logger: logger.child({ schoolId }),
    browser: Browsers.appropriate("Chrome"),
    syncFullHistory: false,
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false,
  });
  sockets().set(schoolId, sock);

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    // "notify" = a genuinely new/live message; "append" is WhatsApp's own
    // history-sync backfill, delivered fresh on every new connection even
    // with syncFullHistory off — this is what makes existing conversations
    // (the ones already on the phone) show up in the inbox at all, the same
    // way opening WhatsApp Web itself immediately shows recent chats.
    // recordChatMessage() dedupes by WhatsApp's own message id, so replaying
    // this backfill on a later reconnect never creates duplicate rows, and
    // countsAsUnread below keeps backfilled messages from inflating unread
    // counts for conversations nobody actually left unread.
    const countsAsUnread = type === "notify";

    for (const msg of messages) {
      const jid = msg.key.remoteJid;
      if (!jid || !msg.message) continue;
      // Groups and broadcast lists are out of scope for this inbox — 1:1
      // phone chats only.
      if (isJidGroup(jid) || isJidBroadcast(jid)) continue;

      const content = describeMessageContent(msg.message);
      if (!content) continue; // protocol/reaction stub — genuinely nothing to show

      const phoneE164 = await resolvePhoneFromJid(sock, jid);
      if (!phoneE164) continue; // an @lid contact WhatsApp hasn't given us a phone-number mapping for yet
      const fromMe = msg.key.fromMe === true;

      const needsAvatar = await chatNeedsAvatarFetch(schoolId, phoneE164).catch(() => false);
      const avatarUrl = needsAvatar ? await sock.profilePictureUrl(jid, "preview").catch(() => undefined) : undefined;

      await recordChatMessage({
        schoolId,
        phoneE164,
        name: fromMe ? undefined : msg.pushName || undefined,
        avatarUrl,
        direction: fromMe ? "out" : "in",
        messageType: content.messageType,
        text: content.text,
        providerMessageId: msg.key.id ?? undefined,
        sentAt: msg.messageTimestamp ? new Date(Number(msg.messageTimestamp) * 1000) : undefined,
        countsAsUnread,
      }).catch((err) => logger.error({ err, schoolId }, "failed to record chat message"));
    }
  });

  sock.ev.on("messages.update", async (updates) => {
    for (const { key, update } of updates) {
      if (update.status === null || update.status === undefined || !key.id) continue;
      const status = ACK_STATUS[update.status];
      if (!status) continue;
      await updateChatMessageStatus(schoolId, key.id, status).catch((err) => logger.error({ err, schoolId }, "failed to update message status"));
    }
  });

  sock.ev.on("connection.update", async (update) => {
    if (update.qr) {
      const dataUrl = await QRCode.toDataURL(update.qr);
      await upsertAccount(schoolId, { status: "connecting", qrCodeDataUrl: dataUrl, qrGeneratedAt: new Date() });
    }

    if (update.connection === "open") {
      const phoneNumber = sock.user?.phoneNumber ? `+${sock.user.phoneNumber}` : sock.user?.id ? `+${sock.user.id.split(/[:@]/)[0]}` : null;
      await upsertAccount(schoolId, {
        status: "connected",
        phoneNumber,
        displayName: sock.user?.name || sock.user?.notify || phoneNumber,
        connectedAt: new Date(),
        qrCodeDataUrl: null,
        qrGeneratedAt: null,
        lastActivityAt: new Date(),
      });
    }

    if (update.connection === "close") {
      sockets().delete(schoolId);
      const statusCode = update.lastDisconnect?.error instanceof Boom ? update.lastDisconnect.error.output?.statusCode : undefined;
      const wasIntentional = intentionalCloses().delete(schoolId);

      if (statusCode === DisconnectReason.loggedOut) {
        await rm(authDir(schoolId), { recursive: true, force: true });
        await upsertAccount(schoolId, {
          status: "logged_out",
          sessionDataJson: null,
          phoneNumber: null,
          displayName: null,
          qrCodeDataUrl: null,
          qrGeneratedAt: null,
          connectedAt: null,
        });
        return;
      }

      if (wasIntentional) {
        await upsertAccount(schoolId, { status: "disconnected", disconnectedAt: new Date() });
        return;
      }

      // Unexpected drop (network blip, restartRequired, etc.) — reconnect
      // automatically using the same saved credentials, no new QR needed.
      startSocket(schoolId).catch((err) => logger.error({ err, schoolId }, "whatsapp reconnect failed"));
    }
  });

  return sock;
}

class BaileysWhatsAppProvider implements WhatsAppProvider {
  readonly id = "baileys";
  readonly isSimulated = false;

  async connect(schoolId: string): Promise<WhatsAppQrCode> {
    await startSocket(schoolId);

    const deadline = Date.now() + CONNECT_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const account = await prisma.whatsAppAccount.findUnique({ where: { schoolId } });
      if (account?.status === "connected") {
        return { dataUrl: "", expiresAt: new Date() };
      }
      if (account?.qrCodeDataUrl && account.qrGeneratedAt) {
        return { dataUrl: account.qrCodeDataUrl, expiresAt: new Date(account.qrGeneratedAt.getTime() + 60_000) };
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    throw new Error("Timed out waiting for WhatsApp to generate a QR code. Try again.");
  }

  async disconnect(schoolId: string): Promise<void> {
    intentionalCloses().add(schoolId);
    const sock = sockets().get(schoolId);
    if (sock) {
      sockets().delete(schoolId);
      await sock.end(undefined);
    } else {
      intentionalCloses().delete(schoolId);
    }
    await upsertAccount(schoolId, { status: "disconnected", disconnectedAt: new Date() });
  }

  async logout(schoolId: string): Promise<void> {
    intentionalCloses().add(schoolId);
    const sock = sockets().get(schoolId);
    sockets().delete(schoolId);
    if (sock) {
      try {
        await sock.logout();
      } catch {
        // Already disconnected server-side — fall through to local cleanup regardless.
      }
    }
    intentionalCloses().delete(schoolId);
    await rm(authDir(schoolId), { recursive: true, force: true });
    await upsertAccount(schoolId, {
      status: "logged_out",
      sessionDataJson: null,
      phoneNumber: null,
      displayName: null,
      qrCodeDataUrl: null,
      qrGeneratedAt: null,
      connectedAt: null,
    });
  }

  async getConnectionStatus(schoolId: string): Promise<WhatsAppConnectionStatus> {
    const account = await prisma.whatsAppAccount.findUnique({ where: { schoolId } });
    if (!account) return { status: "disconnected", phoneNumber: null, displayName: null, connectedAt: null };
    return {
      status: account.status as WhatsAppConnectionStatus["status"],
      phoneNumber: account.phoneNumber,
      displayName: account.displayName,
      connectedAt: account.connectedAt,
    };
  }

  async getQRCode(schoolId: string): Promise<WhatsAppQrCode | null> {
    const account = await prisma.whatsAppAccount.findUnique({ where: { schoolId } });
    if (!account || account.status !== "connecting" || !account.qrCodeDataUrl || !account.qrGeneratedAt) return null;
    return { dataUrl: account.qrCodeDataUrl, expiresAt: new Date(account.qrGeneratedAt.getTime() + 60_000) };
  }

  async getAccountInfo(schoolId: string): Promise<WhatsAppAccountInfo | null> {
    const account = await prisma.whatsAppAccount.findUnique({ where: { schoolId } });
    if (!account || account.status !== "connected" || !account.phoneNumber) return null;
    return { phoneNumber: account.phoneNumber, displayName: account.displayName ?? account.phoneNumber, businessName: account.businessName };
  }

  async sendTextMessage(schoolId: string, to: string, text: string): Promise<WhatsAppSendResult> {
    const sock = sockets().get(schoolId);
    const account = await prisma.whatsAppAccount.findUnique({ where: { schoolId } });
    if (!sock || account?.status !== "connected") throw new WhatsAppNotConnectedError();

    try {
      const result = await sock.sendMessage(jidFor(to), { text });
      await prisma.whatsAppAccount.update({ where: { schoolId }, data: { lastActivityAt: new Date() } });
      return { success: true, providerMessageId: result?.key?.id ?? undefined };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Send failed" };
    }
  }
}

export const baileysWhatsAppProvider = new BaileysWhatsAppProvider();

/**
 * Resumes every school's live connection after a server restart, for
 * accounts that were connected/connecting before the process stopped —
 * without this, a restart would silently leave sendTextMessage() throwing
 * WhatsAppNotConnectedError until an admin happened to revisit the Connect
 * screen. Uses the same saved credentials on disk, so no new QR is shown
 * unless WhatsApp actually invalidated the session server-side.
 */
export async function resumeBaileysConnections(): Promise<void> {
  const accounts = await prisma.whatsAppAccount.findMany({
    where: { provider: "baileys", status: { in: ["connected", "connecting"] } },
    select: { schoolId: true },
  });
  for (const { schoolId } of accounts) {
    if (!existsSync(authDir(schoolId))) continue;
    startSocket(schoolId).catch((err) => logger.error({ err, schoolId }, "whatsapp resume-on-boot failed"));
  }
}
