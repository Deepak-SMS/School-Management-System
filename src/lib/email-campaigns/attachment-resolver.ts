/**
 * Extension point for future per-student personalized attachments (report
 * cards, fee receipts, bonafide certificates, ID cards, exam results) —
 * deliberately not implemented in this build (spec §47: "create the clean
 * extension point... do not implement the entire document-generation system
 * now"). Static, same-for-everyone campaign attachments already work via
 * EmailCampaignAttachment -> UploadedFile (see prisma/schema.prisma) without
 * needing this at all; this interface is only for the day a campaign wants
 * to hand each recipient a *different* file.
 */

export interface ResolvedAttachment {
  filename: string;
  mimeType: string;
  content: Buffer;
}

export interface AttachmentResolverInput {
  studentId: string;
  campaignId: string;
  schoolId: string;
}

export type AttachmentResolver = (input: AttachmentResolverInput) => Promise<ResolvedAttachment[]>;

/** No resolver is registered yet — a campaign that asks for per-student attachments today gets none, honestly, rather than a silent no-op pretending to have worked. */
export async function resolvePersonalizedAttachments(_input: AttachmentResolverInput): Promise<ResolvedAttachment[]> {
  return [];
}
