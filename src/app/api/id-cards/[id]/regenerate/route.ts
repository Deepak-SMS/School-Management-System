import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { renderCardPdf, type DesignElementLike } from "@/lib/pdf/render-card-pdf";
import { resolveStudentFields, resolveStaffFields } from "@/lib/id-cards/resolve-fields";
import { saveFile, readStoredFile } from "@/lib/storage";

const bodySchema = z.object({
  reason: z.enum(["lost", "damaged", "blocked", "other"]).default("other"),
});

async function readBytesFromStoredUrl(url: string | null | undefined): Promise<Buffer | null> {
  if (!url) return null;
  const match = url.match(/\/api\/files\/([^/?]+)/);
  if (!match) return null;
  const stored = await readStoredFile(match[1]);
  return stored?.data ?? null;
}

function verificationUrl(request: NextRequest, code: string) {
  return `${request.nextUrl.origin}/verify/${code}`;
}

/**
 * Regenerates a card as a new version rather than overwriting it — see `CardReplacement`
 * and `IDCard.status = "replaced"`. The student/staff's `QRVerification` row is reused
 * (it's unique per person, not per card) and simply re-pointed at the new card.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("idCards", "edit");
    const { id } = await params;
    const input = bodySchema.parse(await request.json().catch(() => ({})));

    const existing = await prisma.iDCard.findFirst({
      where: { id, schoolId },
      include: {
        template: { include: { elements: true } },
        qrVerification: true,
        student: { include: { class: true, section: true, academicYear: true } },
        staff: { include: { department: { select: { name: true } }, designation: { select: { name: true } } } },
      },
    });
    if (!existing) return NextResponse.json({ error: "ID card not found." }, { status: 404 });
    if (!existing.qrVerification) return NextResponse.json({ error: "This card has no verification record to reuse." }, { status: 422 });

    const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
    const fieldValues = existing.student
      ? resolveStudentFields(existing.student, school)
      : existing.staff
        ? resolveStaffFields(existing.staff, school)
        : {};
    const cardNumber = existing.cardNumber ?? existing.student?.admissionNumber ?? existing.staff?.employeeId ?? "";
    const photoUrl = existing.student?.photoUrl ?? existing.staff?.photoUrl ?? null;

    const [photoBytes, logoBytes] = await Promise.all([readBytesFromStoredUrl(photoUrl), readBytesFromStoredUrl(school.logoUrl)]);
    const elements: DesignElementLike[] = existing.template.elements;

    const pdfBuffer = await renderCardPdf({
      cardWidthMm: existing.template.cardWidthMm,
      cardHeightMm: existing.template.cardHeightMm,
      elements,
      fieldValues,
      qrValue: verificationUrl(request, existing.qrVerification.code),
      barcodeValue: cardNumber,
      photoBytes,
      logoBytes,
    });

    const fileNamePart = existing.student
      ? `${existing.student.admissionNumber}_${existing.student.firstName}_${existing.student.lastName}`
      : `${existing.staff?.employeeId}_${existing.staff?.fullName.replace(/\s+/g, "_")}`;
    const { url: pdfUrl } = await saveFile({
      schoolId,
      kind: "generated_pdf",
      fileName: `${fileNamePart}_v${Date.now()}.pdf`,
      data: pdfBuffer,
      mimeType: "application/pdf",
    });

    const result = await prisma.$transaction(async (tx) => {
      const newCard = await tx.iDCard.create({
        data: {
          schoolId,
          templateId: existing.templateId,
          studentId: existing.studentId,
          staffId: existing.staffId,
          status: "generated",
          cardNumber,
          pdfUrl,
          issuedAt: new Date(),
        },
      });

      await tx.iDCard.update({ where: { id: existing.id }, data: { status: "replaced" } });
      await tx.qRVerification.update({
        where: { id: existing.qrVerification!.id },
        data: { idCardId: newCard.id, isActive: true },
      });
      const replacement = await tx.cardReplacement.create({
        data: {
          schoolId,
          originalCardId: existing.id,
          newCardId: newCard.id,
          reason: input.reason,
          status: "completed",
          resolvedAt: new Date(),
        },
      });
      await recordAudit(tx, {
        schoolId,
        action: "idCard.regenerate",
        entityType: "IDCard",
        entityId: newCard.id,
        before: { id: existing.id, status: existing.status },
        after: { id: newCard.id, status: newCard.status },
      });

      return { newCard, replacement };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
