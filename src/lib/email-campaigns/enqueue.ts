import type { Prisma } from "@/generated/prisma/client";
import { personalizeMessage, personalizeHtml } from "@/lib/communication/personalize";
import type { ResolvedEmailRecipient } from "@/lib/email-campaigns/audience";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CreateCampaignJobsInput {
  schoolId: string;
  campaignId: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  recipients: ResolvedEmailRecipient[];
}

export interface CreateCampaignJobsResult {
  total: number;
  pending: number;
  invalid: number;
  skipped: number;
}

/**
 * The personalize-and-classify step run once at "Confirm & Send" (spec §17):
 * for every resolved recipient — invalid/missing email -> INVALID_RECIPIENT,
 * suppressed (unsubscribed) -> SKIPPED, unresolved {{token}} -> SKIPPED
 * (never sent with a raw token showing), else PENDING. The
 * (campaignId, recipientEmail) unique constraint on EmailJob is the
 * idempotency key spec §17 asks for — upserting here means calling this
 * twice for the same campaign can never create a second job for the same
 * recipient. Always called inside the same transaction as the campaign's
 * draft -> queued status update and recordAudit().
 */
export async function createCampaignJobs(tx: Prisma.TransactionClient, input: CreateCampaignJobsInput): Promise<CreateCampaignJobsResult> {
  const result: CreateCampaignJobsResult = { total: 0, pending: 0, invalid: 0, skipped: 0 };
  const suppressed = new Set(
    (await tx.emailSuppression.findMany({ where: { schoolId: input.schoolId }, select: { email: true } })).map((s) => s.email.toLowerCase()),
  );

  for (const recipient of input.recipients) {
    result.total += 1;
    const email = recipient.emailRaw?.trim().toLowerCase() ?? "";

    const { text: subject, missingVariables: subjectMissing } = personalizeMessage(input.subject, recipient.variableValues);
    const { text: html, missingVariables: htmlMissing } = personalizeHtml(input.bodyHtml, recipient.variableValues);
    const { text } = personalizeMessage(input.bodyText, recipient.variableValues);
    const missingVariables = [...new Set([...subjectMissing, ...htmlMissing])];

    let status: string;
    let lastError: string | undefined;

    if (!email || !EMAIL_RE.test(email)) {
      status = "INVALID_RECIPIENT";
      lastError = "Missing or invalid email address";
    } else if (suppressed.has(email)) {
      status = "SKIPPED";
      lastError = "Recipient has unsubscribed";
    } else if (missingVariables.length > 0) {
      status = "SKIPPED";
      lastError = `missing_variable:${missingVariables.join(",")}`;
    } else {
      status = "PENDING";
    }

    await tx.emailJob.upsert({
      where: { campaignId_recipientEmail: { campaignId: input.campaignId, recipientEmail: email || `invalid-${recipient.studentId ?? Math.random()}` } },
      create: {
        schoolId: input.schoolId,
        campaignId: input.campaignId,
        studentId: recipient.studentId,
        recipientEmail: email,
        recipientName: recipient.name,
        subject,
        renderedHtml: html,
        renderedText: text,
        status,
        lastError,
      },
      update: {}, // already enqueued for this campaign — never re-personalize or re-classify an existing job
    });

    if (status === "PENDING") result.pending += 1;
    else if (status === "INVALID_RECIPIENT") result.invalid += 1;
    else result.skipped += 1;
  }

  return result;
}
