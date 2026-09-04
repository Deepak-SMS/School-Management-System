import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

/** Bulk-resets terminal FAILED/INVALID_NUMBER jobs back to PENDING and flips a completed campaign back to sending — the same worker loop then just picks it back up. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("whatsappCampaigns", "edit");
    const { schoolId } = user;
    const { id } = await params;

    const campaign = await prisma.whatsAppCampaign.findFirst({ where: { id, schoolId } });
    if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

    const result = await prisma.$transaction(async (tx) => {
      const reset = await tx.whatsAppMessageJob.updateMany({
        where: { campaignId: id, status: { in: ["FAILED", "INVALID_NUMBER"] } },
        data: { status: "PENDING", lastError: null, nextAttemptAt: null },
      });
      if (reset.count > 0 && campaign.status === "completed") {
        await tx.whatsAppCampaign.update({ where: { id }, data: { status: "sending", completedAt: null } });
      }
      await recordAudit(tx, { schoolId, userId: user.id, action: "whatsappCampaign.retryFailed", entityType: "WhatsAppCampaign", entityId: id, after: { retried: reset.count } });
      return { retried: reset.count };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return apiError(error);
  }
}
