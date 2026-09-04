import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

/** Cheap cancel: stops claiming new PENDING jobs; the handful already PROCESSING (at most one worker batch) are left to finish rather than interrupted mid-send. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("whatsappCampaigns", "edit");
    const { schoolId } = user;
    const { id } = await params;

    const campaign = await prisma.whatsAppCampaign.findFirst({ where: { id, schoolId } });
    if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    if (campaign.status !== "sending") return NextResponse.json({ error: "Only a sending campaign can be cancelled." }, { status: 409 });

    const result = await prisma.$transaction(async (tx) => {
      const cancelled = await tx.whatsAppMessageJob.updateMany({ where: { campaignId: id, status: "PENDING" }, data: { status: "CANCELLED" } });
      await tx.whatsAppCampaign.update({ where: { id }, data: { status: "cancelled", cancelledAt: new Date() } });
      await recordAudit(tx, { schoolId, userId: user.id, action: "whatsappCampaign.cancel", entityType: "WhatsAppCampaign", entityId: id, after: { cancelledJobs: cancelled.count } });
      return { cancelledJobs: cancelled.count };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return apiError(error);
  }
}
