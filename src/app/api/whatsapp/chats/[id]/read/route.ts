import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("whatsappCampaigns", "edit");
    const { id } = await params;
    await prisma.whatsAppChat.updateMany({ where: { id, schoolId }, data: { unreadCount: 0 } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
