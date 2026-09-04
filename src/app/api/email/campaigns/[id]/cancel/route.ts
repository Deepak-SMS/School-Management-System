import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

/** Cheap cancel (spec §49): stops claiming new PENDING jobs and cancels any still-scheduled send; already-sent emails cannot be recalled. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("emailCampaigns", "edit");
    const { schoolId } = user;
    const { id } = await params;

    const campaign = await prisma.emailCampaign.findFirst({ where: { id, schoolId } });
    if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    if (!["scheduled", "queued", "processing"].includes(campaign.status)) {
      return NextResponse.json({ error: "Only a scheduled or in-progress campaign can be cancelled." }, { status: 409 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const cancelled = await tx.emailJob.updateMany({ where: { campaignId: id, status: "PENDING" }, data: { status: "CANCELLED" } });
      await tx.emailCampaign.update({ where: { id }, data: { status: "cancelled", cancelledAt: new Date() } });
      await recordAudit(tx, { schoolId, userId: user.id, action: "emailCampaign.cancel", entityType: "EmailCampaign", entityId: id, after: { cancelledJobs: cancelled.count } });
      return { cancelledJobs: cancelled.count, alreadySent: campaign.sentCount };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return apiError(error);
  }
}
