import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit, recordStaffActivity } from "@/lib/audit";
import { STAFF_DOCUMENT_TYPES, STAFF_DOCUMENT_TYPE_LABELS } from "@/lib/constants/hr";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { apiError } from "@/lib/api-error";

const documentInputSchema = z.object({
  documentType: z.enum(STAFF_DOCUMENT_TYPES),
  title: z.string().trim().max(150).optional(),
  uploadedFileId: z.string().trim().min(1, "A file is required"),
  expiryDate: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid expiry date"),
});

/** Confirms the employee belongs to the caller's school before any document work. */
async function findStaff(id: string, schoolId: string) {
  return prisma.staff.findFirst({ where: { id, schoolId }, select: { id: true } });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("employeeDocuments", "view");
    const { id } = await params;

    if (!(await findStaff(id, schoolId))) {
      return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    }

    const data = await prisma.staffDocument.findMany({
      where: { staffId: id, schoolId },
      include: {
        uploadedFile: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("employeeDocuments", "create");
    const { schoolId } = user;
    const { id } = await params;

    if (!(await findStaff(id, schoolId))) {
      return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    }

    const input = cleanEmptyStrings(documentInputSchema.parse(await request.json()));

    // The uploaded file must belong to this school — otherwise a guessed id could
    // attach another tenant's file to this employee.
    const file = await prisma.uploadedFile.findFirst({ where: { id: input.uploadedFileId, schoolId } });
    if (!file) return NextResponse.json({ error: "Uploaded file not found." }, { status: 404 });

    const created = await prisma.$transaction(async (tx) => {
      // Re-uploading the same document type supersedes the previous one: the new
      // row takes the next version number and older rows stay for history.
      const previous = await tx.staffDocument.findFirst({
        where: { staffId: id, documentType: input.documentType },
        orderBy: { version: "desc" },
        select: { version: true },
      });

      const row = await tx.staffDocument.create({
        data: {
          schoolId,
          staffId: id,
          documentType: input.documentType,
          title: input.title,
          uploadedFileId: input.uploadedFileId,
          expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
          version: (previous?.version ?? 0) + 1,
          uploadedById: user.id,
          status: "pending",
        },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "employee.document.upload",
        entityType: "StaffDocument",
        entityId: row.id,
        after: { staffId: id, documentType: row.documentType, version: row.version },
      });
      await recordStaffActivity(tx, {
        schoolId,
        staffId: id,
        type: "document_uploaded",
        description: `${STAFF_DOCUMENT_TYPE_LABELS[input.documentType]} uploaded (v${row.version})`,
        actorId: user.id,
      });

      return row;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
