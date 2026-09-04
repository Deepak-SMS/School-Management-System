import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { whatsappContactSchema } from "@/lib/validation/whatsapp-contact";
import { normalizePhone } from "@/lib/whatsapp/phone";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("whatsappContacts", "view");
    const { id } = await params;
    const contact = await prisma.whatsAppContact.findFirst({ where: { id, schoolId } });
    if (!contact) return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    return NextResponse.json(contact);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("whatsappContacts", "edit");
    const { schoolId } = user;
    const { id } = await params;
    const input = whatsappContactSchema.partial().parse(await request.json());

    const existing = await prisma.whatsAppContact.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Contact not found." }, { status: 404 });

    let phoneE164 = existing.phoneE164;
    if (input.phone !== undefined) {
      const normalized = normalizePhone(input.phone);
      if (!normalized.valid || !normalized.e164) return NextResponse.json({ error: "Enter a valid WhatsApp number." }, { status: 422 });
      phoneE164 = normalized.e164;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.whatsAppContact.update({
        where: { id },
        data: {
          name: input.name,
          phoneE164,
          rawPhone: input.phone ?? undefined,
          tagsJson: input.tags ? JSON.stringify(input.tags) : undefined,
          notes: input.notes,
        },
      });
      await recordAudit(tx, { schoolId, userId: user.id, action: "whatsappContact.update", entityType: "WhatsAppContact", entityId: id, before: existing, after: input });
      return row;
    });

    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}

/** Soft-deletes (isActive=false) a contact with message history so History rows keep their reference; hard-deletes an untouched one. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("whatsappContacts", "delete");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.whatsAppContact.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Contact not found." }, { status: 404 });

    const hasHistory = (await prisma.whatsAppMessageJob.count({ where: { contactId: id } })) > 0;

    await prisma.$transaction(async (tx) => {
      if (hasHistory) {
        await tx.whatsAppContact.update({ where: { id }, data: { isActive: false } });
      } else {
        await tx.whatsAppContact.delete({ where: { id } });
      }
      await recordAudit(tx, { schoolId, userId: user.id, action: "whatsappContact.delete", entityType: "WhatsAppContact", entityId: id, before: existing });
    });

    return NextResponse.json({ success: true, deactivated: hasHistory });
  } catch (error) {
    return apiError(error);
  }
}
