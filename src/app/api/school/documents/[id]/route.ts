import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { SCHOOL_DOCUMENT_LABELS } from "@/lib/constants/school-documents";
import { apiError } from "@/lib/api-error";

const reviewSchema = z.object({
  status: z.enum(["verified", "rejected"]),
  note: z.string().trim().max(500).optional(),
});

/** Marks a compliance document verified or rejected. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("schoolProfile", "edit");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.schoolDocument.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Document not found." }, { status: 404 });

    const input = reviewSchema.parse(await request.json());

    if (input.status === "rejected" && !input.note) {
      return NextResponse.json(
        { error: "Validation failed", fieldErrors: { note: ["A reason is required to reject a document."] } },
        { status: 422 },
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.schoolDocument.update({
        where: { id },
        data: {
          status: input.status,
          note: input.status === "rejected" ? input.note : (input.note ?? existing.note),
          verifiedById: user.id,
          verifiedAt: new Date(),
        },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: `school.document.${input.status}`,
        entityType: "SchoolDocument",
        entityId: id,
        before: { status: existing.status },
        after: { status: row.status, note: row.note },
      });

      return row;
    });

    return NextResponse.json({
      ...updated,
      label: SCHOOL_DOCUMENT_LABELS[updated.documentType] ?? updated.documentType,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("schoolProfile", "delete");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.schoolDocument.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Document not found." }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      // Only the record goes; the stored file stays, since other versions may
      // reference it and deleting bytes is not recoverable.
      await tx.schoolDocument.delete({ where: { id } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "school.document.delete",
        entityType: "SchoolDocument",
        entityId: id,
        before: { documentType: existing.documentType, version: existing.version },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
