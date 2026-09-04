import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import { resolveWhatsAppAudience } from "@/lib/whatsapp/audience";
import { normalizePhone } from "@/lib/whatsapp/phone";
import { personalizeMessage } from "@/lib/communication/personalize";

const SAMPLE_SIZE = 20;

/**
 * Runs the missing-variable pre-send check (a hard block, not an honest-report-
 * and-proceed like the AI email precedent) against the whole resolved
 * audience — a raw {{token}} visible to a parent is worse than a skipped
 * email. Read-only: writes nothing, safe to call repeatedly from the wizard.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("whatsappCampaigns", "create");
    const { id } = await params;

    const campaign = await prisma.whatsAppCampaign.findFirst({ where: { id, schoolId } });
    if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

    const filter = campaign.audienceFilterJson ? (JSON.parse(campaign.audienceFilterJson) as Record<string, unknown>) : {};
    const audience = await resolveWhatsAppAudience(campaign.audienceMode as never, {
      schoolId,
      classId: filter.classId as string | undefined,
      sectionId: filter.sectionId as string | undefined,
      thresholdPct: filter.thresholdPct as number | undefined,
      tag: filter.tag as string | undefined,
      contactIds: filter.contactIds as string[] | undefined,
    });

    let invalidPhoneCount = 0;
    let optedOutCount = 0;
    const missingVariableSample: { recipientName: string; missingVariables: string[] }[] = [];
    let missingVariableCount = 0;

    const phonesToCheck = [...new Set(audience.recipients.map((r) => normalizePhone(r.phoneRaw).e164).filter((v): v is string => Boolean(v)))];
    const knownContacts = phonesToCheck.length
      ? await prisma.whatsAppContact.findMany({ where: { schoolId, phoneE164: { in: phonesToCheck } }, select: { phoneE164: true, optedOut: true } })
      : [];
    const optedOutByPhone = new Set(knownContacts.filter((c) => c.optedOut).map((c) => c.phoneE164));

    for (const recipient of audience.recipients) {
      const normalized = normalizePhone(recipient.phoneRaw);
      if (!normalized.valid || !normalized.e164) {
        invalidPhoneCount += 1;
        continue;
      }
      if (optedOutByPhone.has(normalized.e164)) {
        optedOutCount += 1;
        continue;
      }
      const { missingVariables } = personalizeMessage(campaign.messageBody, recipient.variableValues);
      if (missingVariables.length > 0) {
        missingVariableCount += 1;
        if (missingVariableSample.length < SAMPLE_SIZE) missingVariableSample.push({ recipientName: recipient.name, missingVariables });
      }
    }

    return NextResponse.json({
      totalRecipients: audience.recipients.length,
      sendableCount: audience.recipients.length - invalidPhoneCount - optedOutCount - missingVariableCount,
      invalidPhoneCount,
      optedOutCount,
      missingVariableCount,
      missingVariableSample,
    });
  } catch (error) {
    return apiError(error);
  }
}
