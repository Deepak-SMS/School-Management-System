import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { whatsappCampaignCreateSchema } from "@/lib/validation/whatsapp-campaign";
import { resolveWhatsAppAudience } from "@/lib/whatsapp/audience";
import { assertAudienceAllowedForUser } from "@/lib/whatsapp/campaign-scope";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("whatsappCampaigns", "view");
    const params = request.nextUrl.searchParams;
    const status = params.get("status") ?? undefined;

    const where: Prisma.WhatsAppCampaignWhereInput = { schoolId, ...(status && { status }) };
    const data = await prisma.whatsAppCampaign.findMany({ where, orderBy: { createdAt: "desc" }, include: { template: { select: { name: true } } } });
    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    return apiError(error);
  }
}

/** Creates a draft only — resolves and snapshots the audience count, does not enqueue jobs yet. See campaigns/[id]/send for the confirmed send step. */
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("whatsappCampaigns", "create");
    const { schoolId } = user;
    const input = whatsappCampaignCreateSchema.parse(await request.json());

    await assertAudienceAllowedForUser(user, input.audienceMode, input.classId, input.sectionId);

    if (input.templateId) {
      const template = await prisma.whatsAppTemplate.findFirst({ where: { id: input.templateId, schoolId } });
      if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }

    const audience = await resolveWhatsAppAudience(input.audienceMode, {
      schoolId,
      classId: input.classId,
      sectionId: input.sectionId,
      thresholdPct: input.thresholdPct,
      tag: input.tag,
      contactIds: input.contactIds,
    });

    const campaign = await prisma.$transaction(async (tx) => {
      const created = await tx.whatsAppCampaign.create({
        data: {
          schoolId,
          name: input.name,
          templateId: input.templateId,
          messageBody: input.messageBody,
          audienceMode: input.audienceMode,
          audienceFilterJson: JSON.stringify({ classId: input.classId, sectionId: input.sectionId, thresholdPct: input.thresholdPct, tag: input.tag, contactIds: input.contactIds }),
          totalRecipients: audience.recipients.length,
          createdById: user.id,
        },
      });
      await recordAudit(tx, { schoolId, userId: user.id, action: "whatsappCampaign.create", entityType: "WhatsAppCampaign", entityId: created.id, after: { name: input.name, audienceMode: input.audienceMode, recipients: audience.recipients.length } });
      return created;
    });

    return NextResponse.json({ ...campaign, audienceLabel: audience.label }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
