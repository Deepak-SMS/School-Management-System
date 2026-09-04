import { NextRequest, NextResponse } from "next/server";
import { gmail } from "@googleapis/gmail";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { consumeOAuthState, createOAuthClient, GMAIL_SEND_SCOPE } from "@/lib/email-campaigns/oauth";
import { encryptToken } from "@/lib/email-campaigns/token-crypto";

/**
 * Google redirects the browser here after the admin approves (or denies)
 * access. This is a browser navigation, not a fetch — errors redirect back
 * to the settings page with a query param rather than returning JSON.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const settingsUrl = new URL("/communication/email/settings", request.url);

  try {
    if (params.get("error")) {
      settingsUrl.searchParams.set("gmail_error", "Google account authorization was cancelled or denied.");
      return NextResponse.redirect(settingsUrl);
    }

    await consumeOAuthState(params.get("state"));
    const { schoolId, id: userId } = await requirePermission("gmailConnection", "edit");

    const code = params.get("code");
    if (!code) throw new Error("Google did not return an authorization code.");

    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error("Google didn't return a refresh token — try disconnecting and connecting again, approving access when prompted.");
    }

    client.setCredentials(tokens);
    const gmailClient = gmail({ version: "v1", auth: client });
    const profile = await gmailClient.users.getProfile({ userId: "me" });
    const email = profile.data.emailAddress;
    if (!email) throw new Error("Couldn't read the connected Gmail address.");

    const data = {
      googleUserId: email, // no profile/openid scope requested (deliberately minimal — spec §5), so the email itself is the stable identifier
      email,
      accessTokenEncrypted: encryptToken(tokens.access_token),
      refreshTokenEncrypted: encryptToken(tokens.refresh_token),
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scopesJson: JSON.stringify(tokens.scope ? tokens.scope.split(" ") : [GMAIL_SEND_SCOPE]),
      status: "connected",
      lastError: null,
      connectedAt: new Date(),
      disconnectedAt: null,
    };

    await prisma.$transaction(async (tx) => {
      await tx.gmailConnection.upsert({
        where: { schoolId },
        create: { schoolId, createdById: userId, ...data },
        update: data,
      });
      await recordAudit(tx, { schoolId, userId, action: "gmail.connect.completed", entityType: "GmailConnection", entityId: schoolId, after: { email } });
    });

    settingsUrl.searchParams.set("gmail_connected", "1");
    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    settingsUrl.searchParams.set("gmail_error", err instanceof Error ? err.message : "Couldn't connect Gmail. Try again.");
    return NextResponse.redirect(settingsUrl);
  }
}
