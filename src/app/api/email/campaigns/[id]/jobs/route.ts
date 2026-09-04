import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("emailCampaigns", "view");
    const { id } = await params;

    const campaign = await prisma.emailCampaign.findFirst({ where: { id, schoolId } });
    if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") ?? undefined;
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? 50)));

    const where: Prisma.EmailJobWhereInput = { campaignId: id, ...(status && { status }) };
    const [data, total] = await Promise.all([
      prisma.emailJob.findMany({ where, orderBy: { queuedAt: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.emailJob.count({ where }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      pageSize,
      campaign: { status: campaign.status, sentCount: campaign.sentCount, failedCount: campaign.failedCount, totalRecipients: campaign.totalRecipients },
    });
  } catch (error) {
    return apiError(error);
  }
}
