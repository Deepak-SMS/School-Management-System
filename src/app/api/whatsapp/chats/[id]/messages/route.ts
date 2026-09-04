import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("whatsappCampaigns", "edit");
    const { id } = await params;

    const chat = await prisma.whatsAppChat.findFirst({ where: { id, schoolId } });
    if (!chat) return NextResponse.json({ error: "Chat not found." }, { status: 404 });

    const messages = await prisma.whatsAppChatMessage.findMany({ where: { chatId: id }, orderBy: { sentAt: "asc" }, take: 500 });
    return NextResponse.json({ chat, messages });
  } catch (error) {
    return apiError(error);
  }
}
