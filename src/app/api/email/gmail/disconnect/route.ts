import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { getEmailProvider } from "@/lib/email-campaigns/registry";

export async function POST(_request: NextRequest) {
  try {
    const { schoolId, id: userId } = await requirePermission("gmailConnection", "edit");
    await getEmailProvider().disconnect(schoolId);

    await prisma.$transaction((tx) => recordAudit(tx, { schoolId, userId, action: "gmail.disconnect", entityType: "GmailConnection", entityId: schoolId }));

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
