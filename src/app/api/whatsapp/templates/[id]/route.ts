import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { whatsappTemplateSchema } from "@/lib/validation/whatsapp-template";
import { extractVariables } from "@/lib/communication/personalize";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("whatsappTemplates", "view");
    const { id } = await params;
    const template = await prisma.whatsAppTemplate.findFirst({ where: { id, schoolId } });
    if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });
    return NextResponse.json(template);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("whatsappTemplates", "edit");
    const { schoolId } = user;
    const { id } = await params;
    const input = whatsappTemplateSchema.partial().parse(await request.json());

    const existing = await prisma.whatsAppTemplate.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Template not found." }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.whatsAppTemplate.update({
        where: { id },
        data: {
          name: input.name,
          category: input.category,
          bodyText: input.bodyText,
          variablesJson: input.bodyText !== undefined ? JSON.stringify(extractVariables(input.bodyText)) : undefined,
          isActive: input.isActive,
        },
      });
      await recordAudit(tx, { schoolId, userId: user.id, action: "whatsappTemplate.update", entityType: "WhatsAppTemplate", entityId: id, before: existing, after: input });
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
    const user = await requirePermission("whatsappTemplates", "delete");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.whatsAppTemplate.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Template not found." }, { status: 404 });

    const inUse = await prisma.whatsAppCampaign.count({ where: { templateId: id, status: { not: "draft" } } });
    if (inUse > 0) return NextResponse.json({ error: "This template is used by a sent or in-progress campaign and can't be deleted." }, { status: 409 });

    await prisma.$transaction(async (tx) => {
      await tx.whatsAppTemplate.delete({ where: { id } });
      await recordAudit(tx, { schoolId, userId: user.id, action: "whatsappTemplate.delete", entityType: "WhatsAppTemplate", entityId: id, before: existing });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
