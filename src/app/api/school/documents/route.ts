import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { SCHOOL_DOCUMENT_TYPE_VALUES, SCHOOL_DOCUMENT_LABELS } from "@/lib/constants/school-documents";
import { apiError } from "@/lib/api-error";

/**
 * The school's compliance documents — the certificates behind its registration
 * numbers (UDISE, board affiliation, RTE recognition, NOC).
 *
 * Files are stored outside `public/` and reachable only through the
 * authorization-checked `/api/files/[id]` route, since these are the documents
 * an inspection asks for and shouldn't be guessable by URL.
 */
export async function GET() {
  try {
    const { schoolId } = await requirePermission("schoolProfile", "view");

    const data = await prisma.schoolDocument.findMany({
      where: { schoolId },
      include: {
        uploadedFile: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true } },
      },
      orderBy: [{ documentType: "asc" }, { version: "desc" }],
    });

    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    return apiError(error);
  }
}

const documentInputSchema = z.object({
  documentType: z.enum(SCHOOL_DOCUMENT_TYPE_VALUES as [string, ...string[]]),
  title: z.string().trim().max(150).optional(),
  referenceValue: z.string().trim().max(100).optional(),
  uploadedFileId: z.string().trim().min(1, "A file is required"),
  issuedOn: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid issue date"),
  expiresOn: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid expiry date"),
  note: z.string().trim().max(500).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("schoolProfile", "edit");
    const { schoolId } = user;
    const input = cleanEmptyStrings(documentInputSchema.parse(await request.json()));

    if (input.issuedOn && input.expiresOn && new Date(input.issuedOn) > new Date(input.expiresOn)) {
      return NextResponse.json(
        { error: "Validation failed", fieldErrors: { expiresOn: ["Expiry must be after the issue date."] } },
        { status: 422 },
      );
    }

    // The uploaded file must belong to this school, or a guessed id could attach
    // another tenant's file to this record.
    const file = await prisma.uploadedFile.findFirst({ where: { id: input.uploadedFileId, schoolId } });
    if (!file) return NextResponse.json({ error: "Uploaded file not found." }, { status: 404 });

    const created = await prisma.$transaction(async (tx) => {
      // Re-uploading the same kind supersedes the previous one: the new row takes
      // the next version and older rows stay as history.
      const previous = await tx.schoolDocument.findFirst({
        where: { schoolId, documentType: input.documentType },
        orderBy: { version: "desc" },
        select: { version: true },
      });

      const row = await tx.schoolDocument.create({
        data: {
          schoolId,
          documentType: input.documentType,
          title: input.title,
          referenceValue: input.referenceValue,
          uploadedFileId: input.uploadedFileId,
          issuedOn: input.issuedOn ? new Date(input.issuedOn) : undefined,
          expiresOn: input.expiresOn ? new Date(input.expiresOn) : undefined,
          note: input.note,
          version: (previous?.version ?? 0) + 1,
          uploadedById: user.id,
          status: "pending",
        },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "school.document.upload",
        entityType: "SchoolDocument",
        entityId: row.id,
        after: { documentType: row.documentType, version: row.version },
      });

      return row;
    });

    return NextResponse.json(
      { ...created, label: SCHOOL_DOCUMENT_LABELS[created.documentType] ?? created.documentType },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
