import { gmail } from "@googleapis/gmail";
import { GaxiosError } from "gaxios";
import { prisma } from "@/lib/db";
import { encryptToken, decryptToken } from "@/lib/email-campaigns/token-crypto";
import { createOAuthClient } from "@/lib/email-campaigns/oauth";
import { buildRawMimeMessage } from "@/lib/email-campaigns/mime";
import {
  EmailNotConnectedError,
  type EmailConnectionStatus,
  type EmailErrorType,
  type EmailProvider,
  type EmailSendInput,
  type EmailSendResult,
} from "@/lib/email-campaigns/provider";

/**
 * Real Gmail sending via the official `googleapis` client — OAuth2 access/
 * refresh tokens only, never a password (per Google's own guidance for
 * server-side web apps; see docs/gmail-integration.md). Access tokens are
 * refreshed automatically and the newly-issued one is persisted so the next
 * send doesn't have to refresh again.
 */

const TOKEN_REFRESH_MARGIN_MS = 2 * 60 * 1000; // refresh a little before actual expiry, not after

async function loadConnection(schoolId: string) {
  return prisma.gmailConnection.findUnique({ where: { schoolId } });
}

async function getAuthorizedClient(schoolId: string) {
  const connection = await loadConnection(schoolId);
  if (!connection || connection.status !== "connected") throw new EmailNotConnectedError();

  const client = createOAuthClient();
  client.setCredentials({
    access_token: decryptToken(connection.accessTokenEncrypted),
    refresh_token: decryptToken(connection.refreshTokenEncrypted),
    expiry_date: connection.tokenExpiry?.getTime(),
  });

  const needsRefresh = !connection.tokenExpiry || connection.tokenExpiry.getTime() - Date.now() < TOKEN_REFRESH_MARGIN_MS;
  if (needsRefresh) {
    try {
      const { credentials } = await client.refreshAccessToken();
      if (credentials.access_token) {
        await prisma.gmailConnection.update({
          where: { schoolId },
          data: {
            accessTokenEncrypted: encryptToken(credentials.access_token),
            tokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
          },
        });
        client.setCredentials(credentials);
      }
    } catch (err) {
      // A refresh failure this early almost always means Google revoked the
      // grant — mark it so the UI stops pretending this connection works,
      // rather than letting every subsequent send fail the same way silently.
      await prisma.gmailConnection.update({
        where: { schoolId },
        data: { status: "reauth_required", lastError: err instanceof Error ? err.message : "Token refresh failed" },
      });
      throw err;
    }
  }

  return { client, connection };
}

function classifyError(err: unknown): { message: string; errorType: EmailErrorType } {
  if (err instanceof GaxiosError) {
    const code = err.status ?? err.response?.status;
    const message = (err.response?.data as { error?: { message?: string } } | undefined)?.error?.message ?? err.message;
    if (code === 401 || code === 403) return { message, errorType: "AUTH_ERROR" };
    if (code === 429) return { message, errorType: "RATE_LIMIT" };
    if (code === 400) return { message, errorType: "INVALID_RECIPIENT" };
    if (code && code >= 500) return { message, errorType: "PROVIDER_ERROR" };
    return { message, errorType: "RETRYABLE" };
  }
  if (err instanceof Error) {
    if (/ECONNRESET|ETIMEDOUT|ENOTFOUND|network/i.test(err.message)) return { message: err.message, errorType: "NETWORK_ERROR" };
    return { message: err.message, errorType: "RETRYABLE" };
  }
  return { message: "Unknown error", errorType: "RETRYABLE" };
}

class GmailProvider implements EmailProvider {
  readonly id = "gmail";

  async getConnectionStatus(schoolId: string): Promise<EmailConnectionStatus> {
    const connection = await loadConnection(schoolId);
    if (!connection) return { connected: false, email: null, status: "disconnected", lastError: null };
    return {
      connected: connection.status === "connected",
      email: connection.email,
      status: connection.status as EmailConnectionStatus["status"],
      lastError: connection.lastError,
    };
  }

  async validateConnection(schoolId: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const { client } = await getAuthorizedClient(schoolId);
      const gmailClient = gmail({ version: "v1", auth: client });
      await gmailClient.users.getProfile({ userId: "me" });
      await prisma.gmailConnection.update({ where: { schoolId }, data: { lastUsedAt: new Date(), lastError: null } });
      return { ok: true };
    } catch (err) {
      const { message } = classifyError(err);
      return { ok: false, error: message };
    }
  }

  async sendEmail(schoolId: string, input: EmailSendInput): Promise<EmailSendResult> {
    try {
      const { client, connection } = await getAuthorizedClient(schoolId);
      const gmailClient = gmail({ version: "v1", auth: client });

      const raw = buildRawMimeMessage({
        to: input.to,
        fromEmail: connection.email,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });

      const response = await gmailClient.users.messages.send({ userId: "me", requestBody: { raw } });

      const today = new Date();
      const sameDay = connection.dailyMessageCountDate && connection.dailyMessageCountDate.toDateString() === today.toDateString();
      await prisma.gmailConnection.update({
        where: { schoolId },
        data: { lastUsedAt: today, dailyMessageCount: sameDay ? { increment: 1 } : 1, dailyMessageCountDate: today },
      });

      return { success: true, providerMessageId: response.data.id ?? undefined };
    } catch (err) {
      if (err instanceof EmailNotConnectedError) return { success: false, error: err.message, errorType: "AUTH_ERROR" };
      const { message, errorType } = classifyError(err);
      return { success: false, error: message, errorType };
    }
  }

  async disconnect(schoolId: string): Promise<void> {
    const connection = await loadConnection(schoolId);
    if (connection) {
      try {
        const client = createOAuthClient();
        client.setCredentials({ refresh_token: decryptToken(connection.refreshTokenEncrypted) });
        await client.revokeCredentials();
      } catch {
        // Revoke can fail if Google already invalidated it (e.g. the user
        // revoked access from their Google Account page) — the local
        // disconnect below still has to happen either way.
      }
    }
    await prisma.gmailConnection.update({
      where: { schoolId },
      data: { status: "disconnected", disconnectedAt: new Date() },
    });
  }
}

export const gmailProvider = new GmailProvider();
