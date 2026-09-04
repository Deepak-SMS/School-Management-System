import { prisma } from "@/lib/db";

/** DB-based analogue of src/lib/mail.ts's isMailConfigured() — Gmail connection state is per-school, not env-based. */
export async function isGmailConnected(schoolId: string): Promise<boolean> {
  const account = await prisma.gmailConnection.findUnique({ where: { schoolId }, select: { status: true } });
  return account?.status === "connected";
}

export interface GmailAccountSummary {
  connected: boolean;
  status: string;
  email: string | null;
  connectedAt: Date | null;
  dailyMessageCount: number;
  lastError: string | null;
}

/** Backs the Email dashboard's connection card. */
export async function getGmailAccountSummary(schoolId: string): Promise<GmailAccountSummary> {
  const account = await prisma.gmailConnection.findUnique({ where: { schoolId } });
  return {
    connected: account?.status === "connected",
    status: account?.status ?? "disconnected",
    email: account?.email ?? null,
    connectedAt: account?.connectedAt ?? null,
    dailyMessageCount: account?.dailyMessageCount ?? 0,
    lastError: account?.lastError ?? null,
  };
}
