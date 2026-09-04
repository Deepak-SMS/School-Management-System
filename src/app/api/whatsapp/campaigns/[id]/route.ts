import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { whatsappCampaignUpdateSchema } from "@/lib/validation/whatsapp-campaign";
import { resolveWhatsAppAudience } from "@/lib/whatsapp/audience";
import { assertAudienceAllowedForUser } from "@/lib/whatsapp/campaign-scope";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("whatsappCampaigns", "view");
    const { id } = await params;
    const campaign = await prisma.whatsAppCampaign.findFirst({ where: { id, schoolId }, include: { template: { select: { name: true } } } });
    if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    return NextResponse.json(campaign);
  } catch (error) {
    return apiError(error);
  }
}

/** Only a `draft` campaign may change its targeting/message — once sending has started, jobs are already snapshotted and immutable. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("whatsappCampaigns", "edit");
    const { schoolId } = user;
    const { id } = await params;
    const input = whatsappCampaignUpdateSchema.parse(await request.json());

    const existing = await prisma.whatsAppCampaign.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    if (existing.status !== "draft") return NextResponse.json({ error: "Only a draft campaign can be edited." }, { status: 409 });

    const audienceMode = input.audienceMode ?? existing.audienceMode;
    const priorFilter = existing.audienceFilterJson ? (JSON.parse(existing.audienceFilterJson) as Record<string, unknown>) : {};
    const classId = input.classId ?? (priorFilter.classId as string | undefined);
    const sectionId = input.sectionId ?? (priorFilter.sectionId as string | undefined);
    await assertAudienceAllowedForUser(user, audienceMode, classId, sectionId);

    let totalRecipients = existing.totalRecipients;
    let audienceFilterJson = existing.audienceFilterJson;
    if (input.audienceMode || input.classId !== undefined || input.sectionId !== undefined || input.thresholdPct !== undefined || input.tag !== undefined || input.contactIds !== undefined) {
      const thresholdPct = input.thresholdPct ?? (priorFilter.thresholdPct as number | undefined);
      const tag = input.tag ?? (priorFilter.tag as string | undefined);
      const contactIds = input.contactIds ?? (priorFilter.contactIds as string[] | undefined);
      const audience = await resolveWhatsAppAudience(audienceMode as never, { schoolId, classId, sectionId, thresholdPct, tag, contactIds });
      totalRecipients = audience.recipients.length;
      audienceFilterJson = JSON.stringify({ classId, sectionId, thresholdPct, tag, contactIds });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.whatsAppCampaign.update({
        where: { id },
        data: {
          name: input.name,
          templateId: input.templateId,
          messageBody: input.messageBody,
          audienceMode,
          audienceFilterJson,
          totalRecipients,
        },
      });
      await recordAudit(tx, { schoolId, userId: user.id, action: "whatsappCampaign.update", entityType: "WhatsAppCampaign", entityId: id, before: existing, after: input });
      return row;
    });

    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("whatsappCampaigns", "delete");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.whatsAppCampaign.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    if (existing.status !== "draft") return NextResponse.json({ error: "Only a draft campaign can be deleted." }, { status: 409 });

    await prisma.$transaction(async (tx) => {
      await tx.whatsAppCampaign.delete({ where: { id } });
      await recordAudit(tx, { schoolId, userId: user.id, action: "whatsappCampaign.delete", entityType: "WhatsAppCampaign", entityId: id, before: existing });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
