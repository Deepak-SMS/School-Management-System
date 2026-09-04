import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

/** Bulk-resets terminal FAILED jobs back to PENDING (spec §50) — never touches SENT jobs. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("emailCampaigns", "edit");
    const { schoolId } = user;
    const { id } = await params;

    const campaign = await prisma.emailCampaign.findFirst({ where: { id, schoolId } });
    if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

    const result = await prisma.$transaction(async (tx) => {
      const reset = await tx.emailJob.updateMany({
        where: { campaignId: id, status: "FAILED" },
        data: { status: "PENDING", lastError: null, lastErrorType: null, nextAttemptAt: null },
      });
      if (reset.count > 0 && ["completed", "partially_completed", "failed"].includes(campaign.status)) {
        await tx.emailCampaign.update({ where: { id }, data: { status: "queued", completedAt: null, failedCount: { decrement: reset.count } } });
      }
      await recordAudit(tx, { schoolId, userId: user.id, action: "emailCampaign.retryFailed", entityType: "EmailCampaign", entityId: id, after: { retried: reset.count } });
      return { retried: reset.count };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return apiError(error);
  }
}
