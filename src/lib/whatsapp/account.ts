import { prisma } from "@/lib/db";

/**
 * DB-based analogue of src/lib/mail.ts's isMailConfigured() — but WhatsApp
 * connection state is per-school, not env-based, so this checks the
 * WhatsAppAccount row instead of process.env.
 */
export async function isWhatsAppConnected(schoolId: string): Promise<boolean> {
  const account = await prisma.whatsAppAccount.findUnique({ where: { schoolId }, select: { status: true } });
  return account?.status === "connected";
}

export interface WhatsAppAccountSummary {
  connected: boolean;
  status: string;
  provider: string;
  isSimulated: boolean;
  phoneNumber: string | null;
  displayName: string | null;
  connectedAt: Date | null;
  dailyMessageCount: number;
}

/** Backs the WhatsApp Dashboard's status card. */
export async function getWhatsAppAccountSummary(schoolId: string): Promise<WhatsAppAccountSummary> {
  const account = await prisma.whatsAppAccount.findUnique({ where: { schoolId } });
  return {
    connected: account?.status === "connected",
    status: account?.status ?? "disconnected",
    provider: account?.provider ?? "mock",
    isSimulated: (account?.provider ?? "mock") === "mock",
    phoneNumber: account?.phoneNumber ?? null,
    displayName: account?.displayName ?? null,
    connectedAt: account?.connectedAt ?? null,
    dailyMessageCount: account?.dailyMessageCount ?? 0,
  };
}
