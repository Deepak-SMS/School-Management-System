import type { Prisma } from "@/generated/prisma/client";

interface RecordAuditInput {
  schoolId: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}

/**
 * Writes an AuditLog row for an administrative change. `userId`/`ipAddress` are omitted
 * for now — there is no session/auth yet (see src/lib/tenant.ts) — but every mutation
 * across the School Management modules calls this so the audit trail exists once auth ships.
 */
export async function recordAudit(
  tx: Prisma.TransactionClient,
  { schoolId, action, entityType, entityId, before, after }: RecordAuditInput,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      schoolId,
      action,
      entityType,
      entityId,
      metadataJson: JSON.stringify({ before, after }),
    },
  });
}
