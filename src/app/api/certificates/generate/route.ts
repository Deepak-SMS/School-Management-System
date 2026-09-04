import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { generateCertificateInputSchema } from "@/lib/validation/certificate";
import { renderCardPdf, type DesignElementLike } from "@/lib/pdf/render-card-pdf";
import { resolveStudentCertificateFields, resolveStaffCertificateFields } from "@/lib/certificates/resolve-fields";
import { nextCertificateNumber } from "@/lib/certificates/numbering";
import { createCertificateVerification } from "@/lib/certificates/verification";
import { saveFile, readStoredFile } from "@/lib/storage";

function verificationUrl(request: NextRequest, code: string) {
  return `${request.nextUrl.origin}/verify-certificate/${code}`;
}

/** Local file URLs look like `/api/files/{uploadedFileId}` — resolve straight to bytes, or null for anything else. */
async function readBytesFromStoredUrl(url: string | null | undefined): Promise<Buffer | null> {
  if (!url) return null;
  const match = url.match(/\/api\/files\/([^/?]+)/);
  if (!match) return null;
  const stored = await readStoredFile(match[1]);
  return stored?.data ?? null;
}

/**
 * Generates one certificate: resolves the subject's fields, renders the PDF at
 * the template's page size, and creates the Certificate + CertificateVerification
 * rows together. Numbering and the record are created in the same transaction so
 * a certificate row can never exist without a number, or a number be burned
 * without a certificate.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("certificates", "create");
    const { schoolId } = user;
    const input = generateCertificateInputSchema.parse(await request.json());

    if (!input.studentId && !input.staffId) {
      return NextResponse.json({ error: "Select a student or a staff member." }, { status: 400 });
    }

    const [certificateType, template, school] = await Promise.all([
      prisma.certificateType.findFirst({ where: { id: input.certificateTypeId, OR: [{ isSystemType: true }, { schoolId }] } }),
      prisma.certificateTemplate.findFirst({
        where: { id: input.templateId, OR: [{ isSystemTemplate: true }, { schoolId }] },
        include: { elements: true },
      }),
      prisma.school.findUniqueOrThrow({ where: { id: schoolId } }),
    ]);
    if (!certificateType) return NextResponse.json({ error: "Certificate type not found." }, { status: 404 });
    if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });
    if (template.certificateTypeId !== certificateType.id) {
      return NextResponse.json({ error: "This template belongs to a different certificate type." }, { status: 400 });
    }

    let fieldValues: Record<string, string>;
    let photoUrl: string | null = null;
    let academicYearId: string | undefined;

    if (input.studentId) {
      const student = await prisma.student.findFirst({
        where: { id: input.studentId, schoolId },
        include: {
          class: true,
          section: true,
          academicYear: true,
          guardians: { include: { guardian: { select: { fullName: true, mobile: true } } }, orderBy: { sortOrder: "asc" } },
        },
      });
      if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });
      // Placeholder — the real number is minted inside the transaction below; this
      // pass just needs a fieldValues map, so certificate.number is filled in after.
      fieldValues = resolveStudentCertificateFields(student, school, "");
      photoUrl = student.photoUrl;
      academicYearId = student.academicYearId;
    } else {
      const staff = await prisma.staff.findFirst({
        where: { id: input.staffId, schoolId },
        include: { department: true, designation: true },
      });
      if (!staff) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
      fieldValues = resolveStaffCertificateFields(staff, school, "");
      photoUrl = staff.photoUrl;
    }

    const [photoBytes, logoBytes] = await Promise.all([readBytesFromStoredUrl(photoUrl), readBytesFromStoredUrl(school.logoUrl)]);

    const result = await prisma.$transaction(async (tx) => {
      const certificateNumber = await nextCertificateNumber(tx, {
        schoolId,
        certificateTypeId: certificateType.id,
        prefix: certificateType.numberingPrefix,
      });
      const resolvedFields: Record<string, string> = { ...fieldValues, "certificate.number": certificateNumber };

      const certificate = await tx.certificate.create({
        data: {
          schoolId,
          certificateTypeId: certificateType.id,
          templateId: template.id,
          studentId: input.studentId,
          staffId: input.staffId,
          academicYearId,
          certificateNumber,
          status: "generated",
          fieldValuesJson: JSON.stringify(resolvedFields),
          generatedByUserId: user.id,
        },
      });

      const verification = await createCertificateVerification(tx, { schoolId, certificateId: certificate.id });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "certificate.generate",
        entityType: "Certificate",
        entityId: certificate.id,
        after: { certificateNumber, certificateType: certificateType.name },
      });

      return { certificate, resolvedFields, verification };
    });

    const elements: DesignElementLike[] = template.elements;
    const pdfBuffer = await renderCardPdf({
      cardWidthMm: template.pageWidthMm,
      cardHeightMm: template.pageHeightMm,
      elements,
      fieldValues: result.resolvedFields,
      qrValue: verificationUrl(request, result.verification.code),
      barcodeValue: result.certificate.certificateNumber,
      photoBytes,
      logoBytes,
    });

    const namePart = (result.resolvedFields["student.name"] || result.resolvedFields["staff.name"] || "certificate").replace(/\s+/g, "_");
    const { url: pdfUrl } = await saveFile({
      schoolId,
      kind: "generated_pdf",
      fileName: `${result.certificate.certificateNumber.replace(/\//g, "-")}_${namePart}.pdf`,
      data: pdfBuffer,
      mimeType: "application/pdf",
    });

    const finalCertificate = await prisma.certificate.update({
      where: { id: result.certificate.id },
      data: { pdfUrl },
      include: {
        certificateType: true,
        template: { select: { name: true } },
        student: true,
        staff: true,
        verification: { select: { code: true } },
      },
    });

    return NextResponse.json(finalCertificate, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
