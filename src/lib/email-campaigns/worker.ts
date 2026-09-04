import { prisma } from "@/lib/db";
import { getEmailProvider } from "@/lib/email-campaigns/registry";
import type { EmailErrorType } from "@/lib/email-campaigns/provider";

/**
 * The email queue — no Redis/BullMQ, same DB-backed poll-and-claim design as
 * src/lib/whatsapp/worker.ts (see that file's docblock for the full
 * rationale). Idempotency here is two-layered: EmailJob's
 * (campaignId, recipientEmail) unique constraint (src/lib/email-campaigns/enqueue.ts)
 * means a job can only be created once per recipient, and the conditional
 * claim below means it can only be picked up by one tick at a time — spec
 * §17's "before sending: check whether the job is already SENT" requirement,
 * satisfied structurally rather than as a runtime check.
 */

const TICK_INTERVAL_MS = 4000;
const BATCH_SIZE_PER_CAMPAIGN = 5;
const MAX_ATTEMPTS = Number(process.env.EMAIL_MAX_RETRIES ?? 4);
// Attempt 1 is the initial send (no wait). Backoff applies before attempts 2/3/4 — spec §19's worked example (30s / 2min / 10min); any attempt beyond that reuses the last interval.
const BACKOFF_SCHEDULE_MS = [30_000, 120_000, 600_000];
const NON_RETRYABLE_TYPES: EmailErrorType[] = ["NON_RETRYABLE", "INVALID_RECIPIENT", "AUTH_ERROR"];

declare global {
  var __emailWorkerStarted: boolean | undefined;
}

export function startEmailWorker(): void {
  if (globalThis.__emailWorkerStarted) return;
  globalThis.__emailWorkerStarted = true;
  setInterval(() => {
    tick().catch((err) => console.error("[email-worker] tick failed", err));
  }, TICK_INTERVAL_MS);
  console.log("[email-worker] started");
}

/** DRAFT -> SCHEDULED -> QUEUED (spec §25) — a plain status+timestamp check on every tick, so it survives a restart the same way the rest of this worker does, no separate cron needed. */
async function promoteScheduledCampaigns(): Promise<void> {
  await prisma.emailCampaign.updateMany({
    where: { status: "scheduled", scheduledAt: { lte: new Date() } },
    data: { status: "queued" },
  });
}

export async function tick(schoolId?: string): Promise<{ processed: number }> {
  await promoteScheduledCampaigns();
  const campaigns = await prisma.emailCampaign.findMany({
    where: { status: { in: ["queued", "processing"] }, ...(schoolId && { schoolId }) },
    select: { id: true, schoolId: true },
  });
  let processed = 0;
  for (const c of campaigns) processed += await processCampaignBatch(c.id, c.schoolId);
  return { processed };
}

async function processCampaignBatch(campaignId: string, schoolId: string): Promise<number> {
  const candidates = await prisma.emailJob.findMany({
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

  await prisma.emailCampaign.updateMany({ where: { id: campaignId, status: "queued" }, data: { status: "processing", startedAt: new Date() } });

  const provider = getEmailProvider();
  let handled = 0;

  for (const job of candidates) {
    const claim = await prisma.emailJob.updateMany({
      where: { id: job.id, status: job.status },
      data: { status: "PROCESSING", startedAt: new Date() },
    });
    if (claim.count === 0) continue; // lost the race to another tick
    handled += 1;

    try {
      const result = await provider.sendEmail(schoolId, { to: job.recipientEmail, subject: job.subject, html: job.renderedHtml, text: job.renderedText });
      if (result.success) {
        await prisma.emailJob.update({
          where: { id: job.id },
          data: { status: "SENT", sentAt: new Date(), providerMessageId: result.providerMessageId, attempts: { increment: 1 } },
        });
        await prisma.emailCampaign.update({ where: { id: campaignId }, data: { sentCount: { increment: 1 } } });
      } else {
        await failOrRetry(job.id, campaignId, job.attempts, result.error ?? "Send failed", result.errorType);
      }
    } catch (err) {
      await failOrRetry(job.id, campaignId, job.attempts, err instanceof Error ? err.message : String(err), "RETRYABLE");
    }
  }

  await finalizeCampaignIfDone(campaignId);
  return handled;
}

async function failOrRetry(jobId: string, campaignId: string, priorAttempts: number, error: string, errorType: EmailErrorType = "RETRYABLE"): Promise<void> {
  const attempts = priorAttempts + 1;
  const isPermanent = NON_RETRYABLE_TYPES.includes(errorType);

  if (!isPermanent && attempts < MAX_ATTEMPTS) {
    const backoffMs = BACKOFF_SCHEDULE_MS[Math.min(attempts - 1, BACKOFF_SCHEDULE_MS.length - 1)];
    await prisma.emailJob.update({
      where: { id: jobId },
      data: { status: "RETRYING", attempts, lastError: error, lastErrorType: errorType, nextAttemptAt: new Date(Date.now() + backoffMs) },
    });
  } else {
    await prisma.emailJob.update({
      where: { id: jobId },
      data: { status: "FAILED", attempts, lastError: error, lastErrorType: errorType, failedAt: new Date() },
    });
    await prisma.emailCampaign.update({ where: { id: campaignId }, data: { failedCount: { increment: 1 } } });
  }
}

async function finalizeCampaignIfDone(campaignId: string): Promise<void> {
  const remaining = await prisma.emailJob.count({ where: { campaignId, status: { in: ["PENDING", "PROCESSING", "RETRYING"] } } });
  if (remaining === 0) {
    const campaign = await prisma.emailCampaign.findUnique({ where: { id: campaignId }, select: { failedCount: true, sentCount: true, totalRecipients: true } });
    const status = campaign && campaign.failedCount > 0 && campaign.sentCount > 0 ? "partially_completed" : campaign && campaign.failedCount > 0 && campaign.sentCount === 0 ? "failed" : "completed";
    await prisma.emailCampaign.updateMany({
      where: { id: campaignId, status: { in: ["queued", "processing"] } },
      data: { status, completedAt: new Date() },
    });
  }
}
