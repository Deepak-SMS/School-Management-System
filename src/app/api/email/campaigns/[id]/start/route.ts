import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { resolveEmailAudience, type EmailRecipientType } from "@/lib/email-campaigns/audience";
import { assertRecipientTypeAllowedForUser } from "@/lib/email-campaigns/campaign-scope";
import { createCampaignJobs } from "@/lib/email-campaigns/enqueue";
import { isGmailConnected } from "@/lib/email-campaigns/account";

/**
 * The explicit confirm step (spec §17-19, §23: sending is always separate
 * and confirmed) — re-resolves the audience server-side rather than trusting
 * anything from the client, then enqueues jobs for the background worker
 * (src/lib/email-campaigns/worker.ts) to actually send.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("emailCampaigns", "create");
    const { schoolId } = user;
    const { id } = await params;

    const campaign = await prisma.emailCampaign.findFirst({ where: { id, schoolId } });
    if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    if (campaign.status !== "draft") return NextResponse.json({ error: "Only a draft campaign can be sent." }, { status: 409 });

    if (!(await isGmailConnected(schoolId))) {
      return NextResponse.json({ error: "Connect Gmail from Communication → Email → Settings before sending a campaign." }, { status: 409 });
    }

    const filter = campaign.audienceFilterJson ? (JSON.parse(campaign.audienceFilterJson) as Record<string, unknown>) : {};
    const recipientType = campaign.recipientType as EmailRecipientType;
    assertRecipientTypeAllowedForUser(user, recipientType);

    const audience = await resolveEmailAudience(recipientType, {
      schoolId,
      studentIds: filter.studentIds as string[] | undefined,
      classIds: filter.classIds as string[] | undefined,
      sectionIds: filter.sectionIds as string[] | undefined,
      minPendingAmount: filter.minPendingAmount as number | undefined,
      importedRows: filter.importedRows as { name: string; email: string; customFields: Record<string, string> }[] | undefined,
    });

    const counts = await prisma.$transaction(async (tx) => {
      const jobCounts = await createCampaignJobs(tx, { schoolId, campaignId: id, subject: campaign.subject, bodyHtml: campaign.bodyHtml, bodyText: campaign.bodyText, recipients: audience.recipients });

      await tx.emailCampaign.update({
        where: { id },
        data: {
          status: "queued",
          totalRecipients: jobCounts.total,
          invalidCount: jobCounts.invalid,
          skippedCount: jobCounts.skipped,
        },
      });

      await recordAudit(tx, { schoolId, userId: user.id, action: "emailCampaign.start", entityType: "EmailCampaign", entityId: id, after: jobCounts });
      return jobCounts;
    });

    return NextResponse.json({ success: true, ...counts });
  } catch (error) {
    return apiError(error);
  }
}
