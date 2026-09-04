import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { emailCampaignCreateSchema } from "@/lib/validation/email-campaign";
import { resolveEmailAudience } from "@/lib/email-campaigns/audience";
import { assertRecipientTypeAllowedForUser } from "@/lib/email-campaigns/campaign-scope";
import { sanitizeEmailHtml, htmlToPlainText } from "@/lib/email-campaigns/sanitize";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("emailCampaigns", "view");
    const params = request.nextUrl.searchParams;
    const status = params.get("status") ?? undefined;

    const where: Prisma.EmailCampaignWhereInput = { schoolId, ...(status && { status }) };
    const data = await prisma.emailCampaign.findMany({ where, orderBy: { createdAt: "desc" }, include: { template: { select: { name: true } } } });
    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    return apiError(error);
  }
}

/** Creates a draft only — resolves and snapshots the recipient count, does not enqueue jobs yet. See campaigns/[id]/start or /schedule for the confirmed send step. */
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("emailCampaigns", "create");
    const { schoolId } = user;
    const input = emailCampaignCreateSchema.parse(await request.json());

    assertRecipientTypeAllowedForUser(user, input.recipientType);

    if (input.templateId) {
      const template = await prisma.emailTemplate.findFirst({ where: { id: input.templateId, schoolId } });
      if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }

    const bodyHtml = sanitizeEmailHtml(input.bodyHtml);
    const bodyText = htmlToPlainText(bodyHtml);

    const audience = await resolveEmailAudience(input.recipientType, {
      schoolId,
      studentIds: input.studentIds,
      classIds: input.classIds,
      sectionIds: input.sectionIds,
      minPendingAmount: input.minPendingAmount,
      importedRows: input.importedRows,
    });

    const campaign = await prisma.$transaction(async (tx) => {
      const created = await tx.emailCampaign.create({
        data: {
          schoolId,
          name: input.name,
          templateId: input.templateId,
          subject: input.subject,
          bodyHtml,
          bodyText,
          recipientType: input.recipientType,
          audienceFilterJson: JSON.stringify({
            studentIds: input.studentIds,
            classIds: input.classIds,
            sectionIds: input.sectionIds,
            minPendingAmount: input.minPendingAmount,
            importedRows: input.importedRows,
          }),
          totalRecipients: audience.recipients.length,
          createdById: user.id,
        },
      });
      await recordAudit(tx, { schoolId, userId: user.id, action: "emailCampaign.create", entityType: "EmailCampaign", entityId: created.id, after: { name: input.name, recipientType: input.recipientType, recipients: audience.recipients.length } });
      return created;
    });

    return NextResponse.json({ ...campaign, audienceLabel: audience.label }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
