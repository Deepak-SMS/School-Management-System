import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import {
  STUDENT_DOCUMENT_TYPE_VALUES,
  STUDENT_DOCUMENT_LABELS,
  STUDENT_DOCUMENT_TYPES,
} from "@/lib/constants/student-documents";
import { apiError } from "@/lib/api-error";

/** Documents filed for a student — admission papers and academic records. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("students", "view");
    const { id } = await params;
    const category = request.nextUrl.searchParams.get("category") ?? undefined;

    const student = await prisma.student.findFirst({ where: { id, schoolId }, select: { id: true } });
    if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

    const data = await prisma.studentDocument.findMany({
      where: { studentId: id, schoolId, ...(category && { category }) },
      include: {
        uploadedFile: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true } },
      },
      orderBy: [{ category: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    return apiError(error);
  }
}

const documentInputSchema = z.object({
  documentType: z.enum(STUDENT_DOCUMENT_TYPE_VALUES as [string, ...string[]]),
  title: z.string().trim().max(150).optional(),
  uploadedFileId: z.string().trim().min(1, "A file is required"),
  academicYearId: z.string().trim().optional(),
  issuedOn: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Invalid issue date"),
  note: z.string().trim().max(500).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("students", "edit");
    const { schoolId } = user;
    const { id } = await params;

    const student = await prisma.student.findFirst({ where: { id, schoolId }, select: { id: true } });
    if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

    const input = cleanEmptyStrings(documentInputSchema.parse(await request.json()));

    const file = await prisma.uploadedFile.findFirst({ where: { id: input.uploadedFileId, schoolId } });
    if (!file) return NextResponse.json({ error: "Uploaded file not found." }, { status: 404 });

    // The type decides which shelf it goes on, so the admission checklist never
    // fills up with report cards.
    const category =
      STUDENT_DOCUMENT_TYPES.find((t) => t.value === input.documentType)?.category ?? "admission";

    const created = await prisma.$transaction(async (tx) => {
      const previous = await tx.studentDocument.findFirst({
        where: { studentId: id, documentType: input.documentType, academicYearId: input.academicYearId ?? null },
        orderBy: { version: "desc" },
        select: { version: true },
      });

      const row = await tx.studentDocument.create({
        data: {
          schoolId,
          studentId: id,
          documentType: input.documentType,
          category,
          title: input.title,
          uploadedFileId: input.uploadedFileId,
          academicYearId: input.academicYearId,
          issuedOn: input.issuedOn ? new Date(input.issuedOn) : undefined,
          note: input.note,
          version: (previous?.version ?? 0) + 1,
          uploadedById: user.id,
          status: "pending",
        },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "student.document.upload",
        entityType: "StudentDocument",
        entityId: row.id,
        after: { studentId: id, documentType: row.documentType, version: row.version },
      });

      return row;
    });

    return NextResponse.json(
      { ...created, label: STUDENT_DOCUMENT_LABELS[created.documentType] ?? created.documentType },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
