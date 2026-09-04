import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { resolveWhatsAppAudience } from "@/lib/whatsapp/audience";
import { assertAudienceAllowedForUser } from "@/lib/whatsapp/campaign-scope";
import { createCampaignJobs } from "@/lib/whatsapp/enqueue";
import { isWhatsAppConnected } from "@/lib/whatsapp/account";

/**
 * The explicit confirm step (spec §18/§19: sending is always a separate,
 * explicitly-confirmed action from drafting — same discipline
 * src/lib/ai/communication/send.ts already established). Re-resolves the
 * audience server-side rather than trusting anything from the client, then
 * enqueues jobs for the background worker (src/lib/whatsapp/worker.ts) to
 * actually send.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("whatsappCampaigns", "create");
    const { schoolId } = user;
    const { id } = await params;

    const campaign = await prisma.whatsAppCampaign.findFirst({ where: { id, schoolId } });
    if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    if (campaign.status !== "draft") return NextResponse.json({ error: "Only a draft campaign can be sent." }, { status: 409 });

    if (!(await isWhatsAppConnected(schoolId))) {
      return NextResponse.json({ error: "Connect WhatsApp from the Dashboard before sending a campaign." }, { status: 409 });
    }

    const filter = campaign.audienceFilterJson ? (JSON.parse(campaign.audienceFilterJson) as Record<string, unknown>) : {};
    await assertAudienceAllowedForUser(user, campaign.audienceMode, filter.classId as string | undefined, filter.sectionId as string | undefined);

    const audience = await resolveWhatsAppAudience(campaign.audienceMode as never, {
      schoolId,
      classId: filter.classId as string | undefined,
      sectionId: filter.sectionId as string | undefined,
      thresholdPct: filter.thresholdPct as number | undefined,
      tag: filter.tag as string | undefined,
      contactIds: filter.contactIds as string[] | undefined,
    });

    const counts = await prisma.$transaction(async (tx) => {
      const jobCounts = await createCampaignJobs(tx, { schoolId, campaignId: id, messageBody: campaign.messageBody, recipients: audience.recipients });

      await tx.whatsAppCampaign.update({
        where: { id },
        data: {
          status: "sending",
          startedAt: new Date(),
          totalRecipients: jobCounts.total,
          invalidNumberCount: jobCounts.invalidNumber,
          optedOutCount: jobCounts.optedOut,
          skippedCount: jobCounts.skipped,
        },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "whatsappCampaign.send",
        entityType: "WhatsAppCampaign",
        entityId: id,
        after: jobCounts,
      });

      return jobCounts;
    });

    return NextResponse.json({ success: true, ...counts });
  } catch (error) {
    return apiError(error);
  }
}
