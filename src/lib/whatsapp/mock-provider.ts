import { randomBytes } from "crypto";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import {
  WhatsAppNotConnectedError,
  type WhatsAppAccountInfo,
  type WhatsAppConnectionStatus,
  type WhatsAppProvider,
  type WhatsAppQrCode,
  type WhatsAppSendResult,
} from "@/lib/whatsapp/provider";

/**
 * Simulates a WhatsApp Web-style QR connection and message sending — no real
 * WhatsApp traffic. Every UI surface checks `isSimulated` and shows a
 * "Simulation Mode" badge so nobody mistakes this for a live channel. All
 * state lives in WhatsAppAccount, keyed by schoolId — no in-memory map needed
 * (unlike a real Baileys provider, which would need one *in addition to* this
 * same DB bookkeeping, for the live socket object itself).
 */

/** How long a generated QR stays valid before it needs regenerating — display-only; nothing auto-connects on a timer (see performScan). */
const QR_VALIDITY_MS = 5 * 60 * 1000;
const FAILURE_RATE = Number(process.env.WHATSAPP_MOCK_FAILURE_RATE ?? 0.05);
const MIN_SEND_DELAY_MS = 300;
const MAX_SEND_DELAY_MS = 1200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fakePhoneNumber(schoolId: string): string {
  // Deterministic-looking fake number derived from the schoolId, so repeated
  // connects for the same school don't produce a different number each time.
  let hash = 0;
  for (let i = 0; i < schoolId.length; i++) hash = (hash * 31 + schoolId.charCodeAt(i)) >>> 0;
  const nine = String(hash % 900000000 + 100000000);
  return `+9198${nine.slice(0, 8)}`;
}

async function upsertAccount(schoolId: string, data: Record<string, unknown>) {
  return prisma.whatsAppAccount.upsert({
    where: { schoolId },
    create: { schoolId, ...data },
    update: data,
  });
}

/**
 * There is deliberately no timer or "auto-connect on read" here — an earlier
 * version flipped to connected on its own a few seconds after connect(), and
 * that read as a bug ("I logged out and it logged itself back in"), not a
 * convenience. The only way out of "connecting" is an explicit action: the
 * user clicking "Simulate Scan Now" (performScan below), never the passage
 * of time. Scanning the QR with a real phone does nothing — it isn't a real
 * WhatsApp Web login code, and the UI says so.
 */
async function performScan(schoolId: string) {
  return upsertAccount(schoolId, {
    status: "connected",
    phoneNumber: fakePhoneNumber(schoolId),
    displayName: "School WhatsApp (Simulated)",
    businessName: null,
    connectedAt: new Date(),
    qrCodeDataUrl: null,
    qrGeneratedAt: null,
    lastActivityAt: new Date(),
  });
}

class MockWhatsAppProvider implements WhatsAppProvider {
  readonly id = "mock";
  readonly isSimulated = true;

  async connect(schoolId: string): Promise<WhatsAppQrCode> {
    const token = randomBytes(16).toString("hex");
    const dataUrl = await QRCode.toDataURL(`whatsapp-mock-connect:${schoolId}:${token}`);
    const qrGeneratedAt = new Date();

    await upsertAccount(schoolId, {
      status: "connecting",
      qrCodeDataUrl: dataUrl,
      qrGeneratedAt,
      sessionDataJson: JSON.stringify({ token }),
    });

    return { dataUrl, expiresAt: new Date(qrGeneratedAt.getTime() + QR_VALIDITY_MS) };
  }

  async disconnect(schoolId: string): Promise<void> {
    // Mirrors closing the WhatsApp Web tab — the session stays valid.
    await upsertAccount(schoolId, { status: "disconnected", disconnectedAt: new Date() });
  }

  async logout(schoolId: string): Promise<void> {
    await upsertAccount(schoolId, {
      status: "logged_out",
      sessionDataJson: null,
      phoneNumber: null,
      displayName: null,
      businessName: null,
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
    return { dataUrl: account.qrCodeDataUrl, expiresAt: new Date(account.qrGeneratedAt.getTime() + QR_VALIDITY_MS) };
  }

  async getAccountInfo(schoolId: string): Promise<WhatsAppAccountInfo | null> {
    const account = await prisma.whatsAppAccount.findUnique({ where: { schoolId } });
    if (!account || account.status !== "connected" || !account.phoneNumber || !account.displayName) return null;
    return { phoneNumber: account.phoneNumber, displayName: account.displayName, businessName: account.businessName };
  }

  async sendTextMessage(schoolId: string, to: string, _text: string): Promise<WhatsAppSendResult> {
    const account = await prisma.whatsAppAccount.findUnique({ where: { schoolId } });
    if (!account || account.status !== "connected") throw new WhatsAppNotConnectedError();

    await sleep(MIN_SEND_DELAY_MS + Math.random() * (MAX_SEND_DELAY_MS - MIN_SEND_DELAY_MS));

    const today = new Date();
    const sameDay = account.dailyMessageCountDate && account.dailyMessageCountDate.toDateString() === today.toDateString();
    await prisma.whatsAppAccount.update({
      where: { schoolId },
      data: {
        dailyMessageCount: sameDay ? { increment: 1 } : 1,
        dailyMessageCountDate: today,
        lastActivityAt: today,
      },
    });

    if (Math.random() < FAILURE_RATE) {
      return { success: false, error: "Simulated delivery failure" };
    }
    void to;
    return { success: true, providerMessageId: `mock_${randomBytes(8).toString("hex")}` };
  }

  /** Mock-only — not on the WhatsAppProvider interface. Wired to a "Simulate Scan Now" dev button, shown only when the resolved provider isSimulated. */
  async simulateScanNow(schoolId: string): Promise<void> {
    await performScan(schoolId);
  }
}

export const mockWhatsAppProvider = new MockWhatsAppProvider();
export type { MockWhatsAppProvider };
