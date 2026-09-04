import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import { resolveEmailAudience, type EmailRecipientType } from "@/lib/email-campaigns/audience";
import { personalizeMessage, personalizeHtml } from "@/lib/communication/personalize";

const SAMPLE_SIZE = 20;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The missing-variable and invalid-recipient pre-send check (spec §11) — a
 * hard block, not an honest-report-and-proceed: a raw {{token}} visible in a
 * parent's inbox is worse than a skipped email. Read-only, safe to call
 * repeatedly from the wizard's Preview/Review steps.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("emailCampaigns", "create");
    const { id } = await params;

    const campaign = await prisma.emailCampaign.findFirst({ where: { id, schoolId } });
    if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

    const filter = campaign.audienceFilterJson ? (JSON.parse(campaign.audienceFilterJson) as Record<string, unknown>) : {};
    const audience = await resolveEmailAudience(campaign.recipientType as EmailRecipientType, {
      schoolId,
      studentIds: filter.studentIds as string[] | undefined,
      classIds: filter.classIds as string[] | undefined,
      sectionIds: filter.sectionIds as string[] | undefined,
      minPendingAmount: filter.minPendingAmount as number | undefined,
      importedRows: filter.importedRows as { name: string; email: string; customFields: Record<string, string> }[] | undefined,
    });

    let invalidEmailCount = 0;
    let missingVariableCount = 0;
    const missingVariableSample: { recipientName: string; missingVariables: string[] }[] = [];

    for (const recipient of audience.recipients) {
      const email = recipient.emailRaw?.trim().toLowerCase() ?? "";
      if (!email || !EMAIL_RE.test(email)) {
        invalidEmailCount += 1;
        continue;
      }
      const subjectResult = personalizeMessage(campaign.subject, recipient.variableValues);
      const htmlResult = personalizeHtml(campaign.bodyHtml, recipient.variableValues);
      const missing = [...new Set([...subjectResult.missingVariables, ...htmlResult.missingVariables])];
      if (missing.length > 0) {
        missingVariableCount += 1;
        if (missingVariableSample.length < SAMPLE_SIZE) missingVariableSample.push({ recipientName: recipient.name, missingVariables: missing });
      }
    }

    return NextResponse.json({
      totalRecipients: audience.recipients.length,
      sendableCount: audience.recipients.length - invalidEmailCount - missingVariableCount,
      invalidEmailCount,
      missingVariableCount,
      missingVariableSample,
    });
  } catch (error) {
    return apiError(error);
  }
}
