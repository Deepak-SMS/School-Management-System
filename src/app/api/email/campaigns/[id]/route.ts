import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { emailCampaignUpdateSchema } from "@/lib/validation/email-campaign";
import { resolveEmailAudience, type EmailRecipientType } from "@/lib/email-campaigns/audience";
import { assertRecipientTypeAllowedForUser } from "@/lib/email-campaigns/campaign-scope";
import { sanitizeEmailHtml, htmlToPlainText } from "@/lib/email-campaigns/sanitize";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("emailCampaigns", "view");
    const { id } = await params;
    const campaign = await prisma.emailCampaign.findFirst({ where: { id, schoolId }, include: { template: { select: { name: true } } } });
    if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    return NextResponse.json(campaign);
  } catch (error) {
    return apiError(error);
  }
}

/** Only a `draft` campaign may change its targeting/message — once jobs exist, they're already snapshotted and immutable (spec §32: never silently change already-created jobs if fee data changes). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("emailCampaigns", "edit");
    const { schoolId } = user;
    const { id } = await params;
    const input = emailCampaignUpdateSchema.parse(await request.json());

    const existing = await prisma.emailCampaign.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    if (existing.status !== "draft") return NextResponse.json({ error: "Only a draft campaign can be edited." }, { status: 409 });

    const recipientType = (input.recipientType ?? existing.recipientType) as EmailRecipientType;
    const priorFilter = existing.audienceFilterJson ? (JSON.parse(existing.audienceFilterJson) as Record<string, unknown>) : {};
    assertRecipientTypeAllowedForUser(user, recipientType);

    let totalRecipients = existing.totalRecipients;
    let audienceFilterJson = existing.audienceFilterJson;
    if (input.recipientType || input.studentIds || input.classIds || input.sectionIds || input.minPendingAmount !== undefined) {
      const studentIds = input.studentIds ?? (priorFilter.studentIds as string[] | undefined);
      const classIds = input.classIds ?? (priorFilter.classIds as string[] | undefined);
      const sectionIds = input.sectionIds ?? (priorFilter.sectionIds as string[] | undefined);
      const minPendingAmount = input.minPendingAmount ?? (priorFilter.minPendingAmount as number | undefined);
      const audience = await resolveEmailAudience(recipientType, { schoolId, studentIds, classIds, sectionIds, minPendingAmount });
      totalRecipients = audience.recipients.length;
      audienceFilterJson = JSON.stringify({ studentIds, classIds, sectionIds, minPendingAmount });
    }

    const bodyHtml = input.bodyHtml !== undefined ? sanitizeEmailHtml(input.bodyHtml) : undefined;
    const bodyText = bodyHtml !== undefined ? htmlToPlainText(bodyHtml) : undefined;

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.emailCampaign.update({
        where: { id },
        data: { name: input.name, templateId: input.templateId, subject: input.subject, bodyHtml, bodyText, recipientType, audienceFilterJson, totalRecipients },
      });
      await recordAudit(tx, { schoolId, userId: user.id, action: "emailCampaign.update", entityType: "EmailCampaign", entityId: id, before: existing, after: input });
      return row;
    });

    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("emailCampaigns", "delete");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.emailCampaign.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    if (existing.status !== "draft") return NextResponse.json({ error: "Only a draft campaign can be deleted." }, { status: 409 });

    await prisma.$transaction(async (tx) => {
      await tx.emailCampaign.delete({ where: { id } });
      await recordAudit(tx, { schoolId, userId: user.id, action: "emailCampaign.delete", entityType: "EmailCampaign", entityId: id, before: existing });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
