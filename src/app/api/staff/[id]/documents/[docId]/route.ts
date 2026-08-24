import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit, recordStaffActivity } from "@/lib/audit";
import { STAFF_DOCUMENT_TYPE_LABELS, type StaffDocumentType } from "@/lib/constants/hr";
import { apiError } from "@/lib/api-error";

const reviewSchema = z.object({
  status: z.enum(["verified", "rejected"]),
  rejectionNote: z.string().trim().max(500).optional(),
});

/**
 * Verify or reject a filed document. Verification is a distinct permission from
 * upload — the person who files a document should not be the one who approves it.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  try {
    const user = await requirePermission("employeeDocuments", "verify");
    const { schoolId } = user;
    const { id, docId } = await params;

    const existing = await prisma.staffDocument.findFirst({ where: { id: docId, staffId: id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Document not found." }, { status: 404 });

    const input = reviewSchema.parse(await request.json());

    if (input.status === "rejected" && !input.rejectionNote) {
      return NextResponse.json(
        { error: "Validation failed", fieldErrors: { rejectionNote: ["A reason is required to reject a document."] } },
        { status: 422 },
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.staffDocument.update({
        where: { id: docId },
        data: {
          status: input.status,
          rejectionNote: input.status === "rejected" ? input.rejectionNote : null,
          verifiedById: user.id,
          verifiedAt: new Date(),
        },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: `employee.document.${input.status}`,
        entityType: "StaffDocument",
        entityId: docId,
        before: { status: existing.status },
        after: { status: row.status, rejectionNote: row.rejectionNote },
      });
      await recordStaffActivity(tx, {
        schoolId,
        staffId: id,
        type: input.status === "verified" ? "document_verified" : "document_rejected",
        description: `${STAFF_DOCUMENT_TYPE_LABELS[existing.documentType as StaffDocumentType] ?? existing.documentType} ${input.status}${
          input.rejectionNote ? ` — ${input.rejectionNote}` : ""
        }`,
        actorId: user.id,
      });

      return row;
    });

    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  try {
    const user = await requirePermission("employeeDocuments", "delete");
    const { schoolId } = user;
    const { id, docId } = await params;

    const existing = await prisma.staffDocument.findFirst({ where: { id: docId, staffId: id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Document not found." }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.staffDocument.delete({ where: { id: docId } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "employee.document.delete",
        entityType: "StaffDocument",
        entityId: docId,
        before: existing,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
