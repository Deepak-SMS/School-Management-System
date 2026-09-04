import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { whatsappChatSendSchema } from "@/lib/validation/whatsapp-chat";
import { getWhatsAppProviderForSchool } from "@/lib/whatsapp/registry";

/**
 * A direct reply from the inbox, outside any campaign. The sent message
 * isn't written here — the provider's messages.upsert echo
 * (src/lib/whatsapp/baileys-provider.ts) records it into the thread, the
 * same path a reply arriving from the real phone takes, so there's exactly
 * one place a chat message ever gets written.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId, id: userId } = await requirePermission("whatsappCampaigns", "edit");
    const { id } = await params;
    const input = whatsappChatSendSchema.parse(await request.json());

    const chat = await prisma.whatsAppChat.findFirst({ where: { id, schoolId } });
    if (!chat) return NextResponse.json({ error: "Chat not found." }, { status: 404 });

    const provider = await getWhatsAppProviderForSchool(schoolId);
    const result = await provider.sendTextMessage(schoolId, chat.phoneE164, input.text);
    if (!result.success) {
      return NextResponse.json({ error: result.error ?? "WhatsApp couldn't send that message. Try again." }, { status: 502 });
    }

    await prisma.$transaction((tx) => recordAudit(tx, { schoolId, userId, action: "whatsappChat.send", entityType: "WhatsAppChat", entityId: id }));

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
