import { prisma } from "@/lib/db";
import { getWhatsAppProviderForSchool } from "@/lib/whatsapp/registry";

/**
 * The queue "worker" — no Redis/BullMQ in this project. Jobs are rows in
 * WhatsAppMessageJob; this polls the database and claims a batch at a time.
 * Idempotency comes from claiming with a conditional updateMany
 * (`where: { status: <the status just read> }`) — only the caller that
 * actually flips the row proceeds, so even concurrent ticks can't double-send.
 *
 * Started once per server process from src/instrumentation.ts (Next's stable
 * boot hook), so a campaign left "sending" across a restart resumes on its
 * own without anyone needing to open a page first. Single-process scheduler:
 * see WHATSAPP-ROADMAP.md for the documented limitation and the manual
 * /api/whatsapp/worker/tick fallback for a future horizontally-scaled deploy.
 */

const TICK_INTERVAL_MS = 4000;
const BATCH_SIZE_PER_CAMPAIGN = 5; // caps one large campaign from starving others sharing a tick
const MAX_AUTO_RETRIES = 2;
const RETRY_BACKOFF_MS = 30_000; // × attempts

// globalThis-guarded singleton, same idiom src/lib/db.ts uses for the Prisma
// client — a plain module-scope `let` does not reliably survive Next dev's
// Fast Refresh.
declare global {
  var __whatsappWorkerStarted: boolean | undefined;
}

export function startWhatsAppWorker(): void {
  if (globalThis.__whatsappWorkerStarted) return;
  globalThis.__whatsappWorkerStarted = true;
  setInterval(() => {
    tick().catch((err) => console.error("[whatsapp-worker] tick failed", err));
  }, TICK_INTERVAL_MS);
  console.log("[whatsapp-worker] started");
}

/** One polling cycle: every campaign currently "sending" gets one claimed batch. Exported so the manual /tick route can call it directly. */
export async function tick(schoolId?: string): Promise<{ processed: number }> {
  const campaigns = await prisma.whatsAppCampaign.findMany({
    where: { status: "sending", ...(schoolId && { schoolId }) },
    select: { id: true, schoolId: true },
  });
  let processed = 0;
  for (const c of campaigns) processed += await processCampaignBatch(c.id, c.schoolId);
  return { processed };
}

async function processCampaignBatch(campaignId: string, schoolId: string): Promise<number> {
  const candidates = await prisma.whatsAppMessageJob.findMany({
    where: {
      campaignId,
      OR: [{ status: "PENDING" }, { status: "RETRYING", nextAttemptAt: { lte: new Date() } }],
    },
    take: BATCH_SIZE_PER_CAMPAIGN,
    orderBy: { queuedAt: "asc" },
  });

  if (candidates.length === 0) {
    await finalizeCampaignIfDone(campaignId);
    return 0;
  }

  const provider = await getWhatsAppProviderForSchool(schoolId);
  let handled = 0;

  for (const job of candidates) {
    const claim = await prisma.whatsAppMessageJob.updateMany({
      where: { id: job.id, status: job.status },
      data: { status: "PROCESSING" },
    });
    if (claim.count === 0) continue; // lost the race to another tick — skip, not an error
    handled += 1;

    try {
      const result = await provider.sendTextMessage(schoolId, job.phoneE164, job.messageText);
      if (result.success) {
        await prisma.whatsAppMessageJob.update({
          where: { id: job.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
            providerMessageId: result.providerMessageId,
            attempts: { increment: 1 },
          },
        });
        await prisma.whatsAppCampaign.update({ where: { id: campaignId }, data: { sentCount: { increment: 1 } } });
      } else {
        await failOrRetry(job.id, campaignId, job.attempts, result.error ?? "Send failed");
      }
    } catch (err) {
      await failOrRetry(job.id, campaignId, job.attempts, err instanceof Error ? err.message : String(err));
    }
  }

  await finalizeCampaignIfDone(campaignId);
  return handled;
}

async function failOrRetry(jobId: string, campaignId: string, priorAttempts: number, error: string): Promise<void> {
  const attempts = priorAttempts + 1;
  if (attempts <= MAX_AUTO_RETRIES) {
    await prisma.whatsAppMessageJob.update({
      where: { id: jobId },
      data: { status: "RETRYING", attempts, lastError: error, nextAttemptAt: new Date(Date.now() + RETRY_BACKOFF_MS * attempts) },
    });
  } else {
    await prisma.whatsAppMessageJob.update({
      where: { id: jobId },
      data: { status: "FAILED", attempts, lastError: error, failedAt: new Date() },
    });
    await prisma.whatsAppCampaign.update({ where: { id: campaignId }, data: { failedCount: { increment: 1 } } });
  }
}

async function finalizeCampaignIfDone(campaignId: string): Promise<void> {
  const remaining = await prisma.whatsAppMessageJob.count({
    where: { campaignId, status: { in: ["PENDING", "PROCESSING", "RETRYING"] } },
  });
  if (remaining === 0) {
    await prisma.whatsAppCampaign.updateMany({
      where: { id: campaignId, status: "sending" },
      data: { status: "completed", completedAt: new Date() },
    });
  }
}
