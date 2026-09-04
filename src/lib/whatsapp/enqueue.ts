import type { Prisma } from "@/generated/prisma/client";
import { normalizePhone } from "@/lib/whatsapp/phone";
import { personalizeMessage } from "@/lib/communication/personalize";
import type { ResolvedWhatsAppRecipient } from "@/lib/whatsapp/audience";

export interface CreateCampaignJobsInput {
  schoolId: string;
  campaignId: string;
  messageBody: string;
  recipients: ResolvedWhatsAppRecipient[];
}

export interface CreateCampaignJobsResult {
  total: number;
  pending: number;
  invalidNumber: number;
  optedOut: number;
  skipped: number;
}

/**
 * The personalize-and-classify step run once at "Confirm & Send" — for every
 * resolved recipient: normalize the phone (bad number -> INVALID_NUMBER),
 * resolve/create the matching WhatsAppContact by phone so opt-out is
 * centrally enforced (bad news -> OPTED_OUT), personalize the message (an
 * unresolved {{token}} -> SKIPPED, never sent with a raw token showing), else
 * PENDING. Always called inside the same transaction as the campaign's
 * draft -> sending status update and recordAudit().
 */
export async function createCampaignJobs(tx: Prisma.TransactionClient, input: CreateCampaignJobsInput): Promise<CreateCampaignJobsResult> {
  const result: CreateCampaignJobsResult = { total: 0, pending: 0, invalidNumber: 0, optedOut: 0, skipped: 0 };

  for (const recipient of input.recipients) {
    result.total += 1;
    const { text, missingVariables } = personalizeMessage(input.messageBody, recipient.variableValues);

    const normalized = normalizePhone(recipient.phoneRaw);
    if (!normalized.valid || !normalized.e164) {
      await tx.whatsAppMessageJob.create({
        data: {
          schoolId: input.schoolId,
          campaignId: input.campaignId,
          contactId: recipient.contactId,
          studentId: recipient.studentId,
          guardianId: recipient.guardianId,
          recipientName: recipient.name,
          phoneE164: recipient.phoneRaw ?? "",
          messageText: text,
          variablesJson: JSON.stringify(recipient.variableValues),
          status: "INVALID_NUMBER",
          lastError: `Invalid phone number (${normalized.reason ?? "unknown"})`,
        },
      });
      result.invalidNumber += 1;
      continue;
    }

    const contact = recipient.contactId
      ? await tx.whatsAppContact.findUnique({ where: { id: recipient.contactId } })
      : await tx.whatsAppContact.upsert({
          where: { schoolId_phoneE164: { schoolId: input.schoolId, phoneE164: normalized.e164 } },
          create: {
            schoolId: input.schoolId,
            studentId: recipient.studentId,
            guardianId: recipient.guardianId,
            source: recipient.studentId || recipient.guardianId ? "student_guardian" : "manual",
            name: recipient.name,
            phoneE164: normalized.e164,
            rawPhone: recipient.phoneRaw,
          },
          update: {},
        });

    if (contact?.optedOut) {
      await tx.whatsAppMessageJob.create({
        data: {
          schoolId: input.schoolId,
          campaignId: input.campaignId,
          contactId: contact.id,
          studentId: recipient.studentId,
          guardianId: recipient.guardianId,
          recipientName: recipient.name,
          phoneE164: normalized.e164,
          messageText: text,
          variablesJson: JSON.stringify(recipient.variableValues),
          status: "OPTED_OUT",
        },
      });
      result.optedOut += 1;
      continue;
    }

    if (missingVariables.length > 0) {
      await tx.whatsAppMessageJob.create({
        data: {
          schoolId: input.schoolId,
          campaignId: input.campaignId,
          contactId: contact?.id,
          studentId: recipient.studentId,
          guardianId: recipient.guardianId,
          recipientName: recipient.name,
          phoneE164: normalized.e164,
          messageText: text,
          variablesJson: JSON.stringify(recipient.variableValues),
          status: "SKIPPED",
          lastError: `missing_variable:${missingVariables.join(",")}`,
        },
      });
      result.skipped += 1;
      continue;
    }

    await tx.whatsAppMessageJob.create({
      data: {
        schoolId: input.schoolId,
        campaignId: input.campaignId,
        contactId: contact?.id,
        studentId: recipient.studentId,
        guardianId: recipient.guardianId,
        recipientName: recipient.name,
        phoneE164: normalized.e164,
        messageText: text,
        variablesJson: JSON.stringify(recipient.variableValues),
        status: "PENDING",
      },
    });
    result.pending += 1;
  }

  return result;
}
