import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

/** Cross-campaign Message History search — backs the History page's table. */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("whatsappCampaigns", "view");
    const params = request.nextUrl.searchParams;
    const q = params.get("q")?.trim();
    const status = params.get("status") ?? undefined;
    const campaignId = params.get("campaignId") ?? undefined;
    const from = params.get("from");
    const to = params.get("to");
    const page = Math.max(1, Number(params.get("page") ?? 1));
    const pageSize = Math.min(200, Math.max(1, Number(params.get("pageSize") ?? 50)));

    const where: Prisma.WhatsAppMessageJobWhereInput = {
      schoolId,
      ...(status && { status }),
      ...(campaignId && { campaignId }),
      ...(q && { OR: [{ recipientName: { contains: q } }, { phoneE164: { contains: q } }] }),
      ...((from || to) && {
        createdAt: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to) }),
        },
      }),
    };

    const [data, total] = await Promise.all([
      prisma.whatsAppMessageJob.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { campaign: { select: { name: true } } },
      }),
      prisma.whatsAppMessageJob.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    return apiError(error);
  }
}
