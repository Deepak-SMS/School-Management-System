import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string; jobId: string }> }) {
  try {
    const user = await requirePermission("whatsappCampaigns", "edit");
    const { schoolId } = user;
    const { id, jobId } = await params;

    const job = await prisma.whatsAppMessageJob.findFirst({ where: { id: jobId, campaignId: id, schoolId } });
    if (!job) return NextResponse.json({ error: "Message not found." }, { status: 404 });
    if (!["FAILED", "INVALID_NUMBER"].includes(job.status)) {
      return NextResponse.json({ error: "Only a failed or invalid-number message can be retried." }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.whatsAppMessageJob.update({ where: { id: jobId }, data: { status: "PENDING", lastError: null, nextAttemptAt: null } });
      await tx.whatsAppCampaign.updateMany({ where: { id, status: "completed" }, data: { status: "sending", completedAt: null } });
      await recordAudit(tx, { schoolId, userId: user.id, action: "whatsappMessageJob.retry", entityType: "WhatsAppMessageJob", entityId: jobId });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
