import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import { isGoogleOAuthConfigured } from "@/lib/email-campaigns/oauth";
import { getEmailProvider } from "@/lib/email-campaigns/registry";
import { getGmailAccountSummary } from "@/lib/email-campaigns/account";

export async function GET(_request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("gmailConnection", "view");
    const status = await getEmailProvider().getConnectionStatus(schoolId);
    const summary = await getGmailAccountSummary(schoolId);

    return NextResponse.json({
      ...status,
      configured: isGoogleOAuthConfigured(),
      dailyMessageCount: summary.dailyMessageCount,
      connectedAt: summary.connectedAt,
    });
  } catch (error) {
    return apiError(error);
  }
}
