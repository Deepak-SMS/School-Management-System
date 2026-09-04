import { prisma } from "@/lib/db";

interface RecordAiRequestInput {
  schoolId: string;
  userId: string;
  module: "assistant" | "analytics" | "reports" | "communication";
  model: string;
  status: "success" | "error" | "stopped";
  responseTimeMs: number;
  errorMessage?: string;
}

/** One row per completed call to the AI provider — feeds /api/ai/health-adjacent reporting and a future AI dashboard. */
export async function recordAiRequest(input: RecordAiRequestInput): Promise<void> {
  await prisma.aiRequest.create({ data: input });
}

interface RecordAiAuditInput {
  schoolId: string;
  userId: string | null;
  action: string;
  module: "assistant" | "analytics" | "reports" | "communication" | "documents";
  metadata?: unknown;
}

/** Append-only, mirrors src/lib/audit.ts::recordAudit for AI-specific actions (AI-ROADMAP.md §3). */
export async function recordAiAudit({ schoolId, userId, action, module, metadata }: RecordAiAuditInput): Promise<void> {
  await prisma.aiAuditLog.create({
    data: {
      schoolId,
      userId: userId ?? undefined,
      action,
      module,
      metadataJson: metadata !== undefined ? JSON.stringify(metadata) : undefined,
    },
  });
}
