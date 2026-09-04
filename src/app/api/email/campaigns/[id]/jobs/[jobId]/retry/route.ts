import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string; jobId: string }> }) {
  try {
    const user = await requirePermission("emailCampaigns", "edit");
    const { schoolId } = user;
    const { id, jobId } = await params;

    const job = await prisma.emailJob.findFirst({ where: { id: jobId, campaignId: id, schoolId } });
    if (!job) return NextResponse.json({ error: "Message not found." }, { status: 404 });
    if (job.status !== "FAILED") return NextResponse.json({ error: "Only a failed message can be retried." }, { status: 409 });

    await prisma.$transaction(async (tx) => {
      await tx.emailJob.update({ where: { id: jobId }, data: { status: "PENDING", lastError: null, lastErrorType: null, nextAttemptAt: null } });
      await tx.emailCampaign.updateMany({
        where: { id, status: { in: ["completed", "partially_completed", "failed"] } },
        data: { status: "queued", completedAt: null, failedCount: { decrement: 1 } },
      });
      await recordAudit(tx, { schoolId, userId: user.id, action: "emailJob.retry", entityType: "EmailJob", entityId: jobId });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
