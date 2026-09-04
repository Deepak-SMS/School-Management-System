import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { whatsappContactOptOutSchema } from "@/lib/validation/whatsapp-contact";

/** School staff acting on a verbal/manual "stop messaging me" request — every future campaign audience resolution respects this. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("whatsappContacts", "edit");
    const { schoolId } = user;
    const { id } = await params;
    const input = whatsappContactOptOutSchema.parse(await request.json().catch(() => ({})));

    const existing = await prisma.whatsAppContact.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Contact not found." }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.whatsAppContact.update({
        where: { id },
        data: { optedOut: true, optedOutAt: new Date(), optedOutReason: input.reason },
      });
      await recordAudit(tx, { schoolId, userId: user.id, action: "whatsappContact.optOut", entityType: "WhatsAppContact", entityId: id });
      return row;
    });

    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}
