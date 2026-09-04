import { prisma } from "@/lib/db";
import { aiConfig } from "@/lib/ai/config";

export class AiQuotaExceededError extends Error {
  constructor(quota: number) {
    super(`This account has reached its AI request limit for this month (${quota} requests). It resets at the start of next month.`);
    this.name = "AiQuotaExceededError";
  }
}

function currentPeriodStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Throws AiQuotaExceededError if this user has already used their monthly allotment. Checked before calling the provider. */
export async function assertWithinQuota(schoolId: string, userId: string): Promise<void> {
  const usage = await prisma.aiUsage.findUnique({
    where: { schoolId_userId_periodStart: { schoolId, userId, periodStart: currentPeriodStart() } },
    select: { requestCount: true },
  });
  if (usage && usage.requestCount >= aiConfig.defaultMonthlyQuota) {
    throw new AiQuotaExceededError(aiConfig.defaultMonthlyQuota);
  }
}

/** Records one request against this user's monthly usage — called once per attempt, success or failure, since the compute was spent either way. */
export async function incrementUsage(schoolId: string, userId: string, model: string, estimatedTokens = 0): Promise<void> {
  const periodStart = currentPeriodStart();
  await prisma.aiUsage.upsert({
    where: { schoolId_userId_periodStart: { schoolId, userId, periodStart } },
    create: { schoolId, userId, model, periodStart, requestCount: 1, estimatedTokens },
    update: { requestCount: { increment: 1 }, estimatedTokens: { increment: estimatedTokens }, model },
  });
}
