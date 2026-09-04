import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { emailTemplateSchema } from "@/lib/validation/email-template";
import { extractVariables } from "@/lib/communication/personalize";
import { sanitizeEmailHtml, htmlToPlainText } from "@/lib/email-campaigns/sanitize";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("emailTemplates", "view");
    const { id } = await params;
    const template = await prisma.emailTemplate.findFirst({ where: { id, schoolId } });
    if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });
    return NextResponse.json(template);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("emailTemplates", "edit");
    const { schoolId } = user;
    const { id } = await params;
    const input = emailTemplateSchema.partial().parse(await request.json());

    const existing = await prisma.emailTemplate.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Template not found." }, { status: 404 });

    const bodyHtml = input.bodyHtml !== undefined ? sanitizeEmailHtml(input.bodyHtml) : undefined;
    const bodyText = bodyHtml !== undefined ? htmlToPlainText(bodyHtml) : undefined;

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.emailTemplate.update({
        where: { id },
        data: {
          name: input.name,
          description: input.description,
          category: input.category,
          subject: input.subject,
          bodyHtml,
          bodyText,
          variablesJson:
            input.subject !== undefined || bodyHtml !== undefined
              ? JSON.stringify([...new Set([...extractVariables(input.subject ?? existing.subject), ...extractVariables(bodyHtml ?? existing.bodyHtml)])])
              : undefined,
          isActive: input.isActive,
          updatedById: user.id,
        },
      });
      await recordAudit(tx, { schoolId, userId: user.id, action: "emailTemplate.update", entityType: "EmailTemplate", entityId: id, before: existing, after: input });
      return row;
    });

    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}

/** Blocked if a non-draft campaign still references this template — that campaign's history must keep pointing at real template data. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("emailTemplates", "delete");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.emailTemplate.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Template not found." }, { status: 404 });

    const inUse = await prisma.emailCampaign.count({ where: { templateId: id, status: { not: "draft" } } });
    if (inUse > 0) return NextResponse.json({ error: "This template is used by a sent or in-progress campaign and can't be deleted." }, { status: 409 });

    await prisma.$transaction(async (tx) => {
      await tx.emailTemplate.delete({ where: { id } });
      await recordAudit(tx, { schoolId, userId: user.id, action: "emailTemplate.delete", entityType: "EmailTemplate", entityId: id, before: existing });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
