import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

/**
 * The real WhatsApp chat list for the connected number — distinct from
 * /api/whatsapp/messages (the campaign-send log). Gated behind
 * whatsappCampaigns:edit rather than :view — unlike a scoped campaign
 * audience, an inbox shows every conversation on the school's number at
 * once, which only the roles already holding unrestricted campaign access
 * (school_admin/principal/super_admin, per the ROLE_PERMISSIONS grants) get.
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("whatsappCampaigns", "edit");
    const q = request.nextUrl.searchParams.get("q")?.trim();

    const where: Prisma.WhatsAppChatWhereInput = {
      schoolId,
      ...(q && { OR: [{ name: { contains: q } }, { phoneE164: { contains: q } }] }),
    };

    const data = await prisma.whatsAppChat.findMany({ where, orderBy: { lastMessageAt: "desc" }, take: 200 });
    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    return apiError(error);
  }
}
