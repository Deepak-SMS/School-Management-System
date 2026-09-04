import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-error";
import { buildAuthorizationUrl } from "@/lib/email-campaigns/oauth";

/** Starts the Google OAuth 2.0 authorization-code flow — redirects the browser to Google's consent screen. Never touches a Gmail password. */
export async function GET(_request: NextRequest) {
  try {
    const { schoolId, id: userId } = await requirePermission("gmailConnection", "edit");
    const url = await buildAuthorizationUrl();

    await prisma.$transaction((tx) => recordAudit(tx, { schoolId, userId, action: "gmail.connect.initiated", entityType: "GmailConnection", entityId: schoolId }));

    return NextResponse.redirect(url);
  } catch (error) {
    return apiError(error);
  }
}
