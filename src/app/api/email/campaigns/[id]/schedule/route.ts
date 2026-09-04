import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { emailCampaignScheduleSchema } from "@/lib/validation/email-campaign";
import { resolveEmailAudience, type EmailRecipientType } from "@/lib/email-campaigns/audience";
import { assertRecipientTypeAllowedForUser } from "@/lib/email-campaigns/campaign-scope";
import { createCampaignJobs } from "@/lib/email-campaigns/enqueue";
import { isGmailConnected } from "@/lib/email-campaigns/account";

/**
 * Same confirm-and-enqueue step as /start, except the campaign lands as
 * "scheduled" instead of "queued" — jobs are personalized and created right
 * now (so fee amounts are locked to today's real numbers, spec §32), but the
 * worker's scheduled-campaign promotion (src/lib/email-campaigns/worker.ts)
 * only starts claiming them once scheduledAt arrives.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("emailCampaigns", "create");
    const { schoolId } = user;
    const { id } = await params;
    const input = emailCampaignScheduleSchema.parse(await request.json());
    const scheduledAt = new Date(input.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: "Choose a valid future date and time." }, { status: 422 });
    }

    const campaign = await prisma.emailCampaign.findFirst({ where: { id, schoolId } });
    if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    if (campaign.status !== "draft") return NextResponse.json({ error: "Only a draft campaign can be scheduled." }, { status: 409 });

    if (!(await isGmailConnected(schoolId))) {
      return NextResponse.json({ error: "Connect Gmail from Communication → Email → Settings before scheduling a campaign." }, { status: 409 });
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
        data: { status: "scheduled", scheduledAt, totalRecipients: jobCounts.total, invalidCount: jobCounts.invalid, skippedCount: jobCounts.skipped },
      });

      await recordAudit(tx, { schoolId, userId: user.id, action: "emailCampaign.schedule", entityType: "EmailCampaign", entityId: id, after: { scheduledAt, ...jobCounts } });
      return jobCounts;
    });

    return NextResponse.json({ success: true, scheduledAt, ...counts });
  } catch (error) {
    return apiError(error);
  }
}
