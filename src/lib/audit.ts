import type { Prisma } from "@/generated/prisma/client";

interface RecordAuditInput {
  schoolId: string;
  action: string;
  entityType: string;
  entityId: string;
  /** Acting user, from `getCurrentUser()`. Null until a User row exists for them. */
  userId?: string | null;
  ipAddress?: string | null;
  before?: unknown;
  after?: unknown;
}

/**
 * Writes an AuditLog row for an administrative change.
 *
 * Always called with the `tx` from the same `$transaction` as the mutation it
 * describes, so a change can never be committed without its audit entry. The
 * log is append-only — no route exposes update or delete for AuditLog.
 */
export async function recordAudit(
  tx: Prisma.TransactionClient,
  { schoolId, action, entityType, entityId, userId, ipAddress, before, after }: RecordAuditInput,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      schoolId,
      userId: userId ?? undefined,
      ipAddress: ipAddress ?? undefined,
      action,
      entityType,
      entityId,
      metadataJson: JSON.stringify({ before, after }),
    },
  });
}

interface StaffActivityInput {
  schoolId: string;
  staffId: string;
  /** created | profile_updated | department_changed | designation_changed | status_changed | transferred | document_uploaded | document_verified | document_rejected | converted_from_candidate */
  type: string;
  description: string;
  actorId?: string | null;
}

/**
 * Writes the human-readable employee timeline entry shown on the profile's
 * Activity tab. Paired with `recordAudit` — that one is the compliance record
 * across every module, this one is the per-employee story.
 */
export async function recordStaffActivity(
  tx: Prisma.TransactionClient,
  { schoolId, staffId, type, description, actorId }: StaffActivityInput,
): Promise<void> {
  await tx.staffActivityLog.create({
    data: { schoolId, staffId, type, description, actorId: actorId ?? undefined },
  });
}

interface RecordPlatformAuditInput {
  actorUserId: string;
  action: string;
  targetSchoolId?: string | null;
  metadata?: unknown;
}

/**
 * Writes a PlatformAuditLog row for a Super Admin action (create school,
 * change status, toggle modules). Separate from recordAudit()/AuditLog,
 * which is hard schoolId-scoped — these actions target the schools
 * themselves, not records inside one school.
 */
export async function recordPlatformAudit(
  tx: Prisma.TransactionClient,
  { actorUserId, action, targetSchoolId, metadata }: RecordPlatformAuditInput,
): Promise<void> {
  await tx.platformAuditLog.create({
    data: {
      actorUserId,
      action,
      targetSchoolId: targetSchoolId ?? undefined,
      metadataJson: metadata !== undefined ? JSON.stringify(metadata) : undefined,
    },
  });
}

/**
 * Describes a field change in the "X changed from A to B" form used by both the
 * audit metadata and the activity timeline.
 */
export function describeChange(label: string, before: unknown, after: unknown): string {
  const from = before === null || before === undefined || before === "" ? "—" : String(before);
  const to = after === null || after === undefined || after === "" ? "—" : String(after);
  return `${label} changed from ${from} to ${to}`;
}
