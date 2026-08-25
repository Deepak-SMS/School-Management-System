import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { resolveStudentFields, resolveStaffFields } from "@/lib/id-cards/resolve-fields";
import { readBytesFromStoredUrl, verificationUrl } from "@/lib/id-cards/card-assets";
import { renderCardPdf, type DesignElementLike } from "@/lib/pdf/render-card-pdf";
import { apiError } from "@/lib/api-error";

/**
 * Downloads one person's ID card as a print-ready PDF.
 *
 * Uses the school's **fixed design** for that category — the same template the
 * on-screen preview renders and that bulk generation would print — so what you
 * see, what you download, and what the printer produces are the same artwork.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  try {
    const { schoolId } = await requirePermission("idCards", "view");
    const { type, id } = await params;

    if (!["student", "teacher", "staff"].includes(type)) {
      return NextResponse.json({ error: "Unknown person type." }, { status: 400 });
    }

    const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
    const isStudent = type === "student";

    const student = isStudent
      ? await prisma.student.findFirst({
          where: { id, schoolId },
          include: {
            class: true,
            section: true,
            academicYear: true,
            guardians: { include: { guardian: true } },
            qrVerification: { select: { code: true } },
            idCards: { include: { template: true }, orderBy: { createdAt: "desc" }, take: 1 },
          },
        })
      : null;

    const staff = !isStudent
      ? await prisma.staff.findFirst({
          where: { id, schoolId },
          include: {
            department: { select: { name: true } },
            designation: { select: { name: true } },
            qrVerification: { select: { code: true } },
            idCards: { include: { template: true }, orderBy: { createdAt: "desc" }, take: 1 },
          },
        })
      : null;

    if (!student && !staff) return NextResponse.json({ error: "Person not found." }, { status: 404 });

    const existingCard = (student ?? staff)!.idCards[0] ?? null;

    // The card's own template if issued; otherwise the fixed design for this
    // category (isDefault), falling back to any active template.
    const template =
      existingCard?.template ??
      (await prisma.iDCardTemplate.findFirst({
        where: {
          isActive: true,
          category: isStudent ? "student" : { in: ["staff", "teacher"] },
          OR: [{ schoolId }, { isSystemTemplate: true }],
        },
        orderBy: [{ schoolId: "desc" }, { isDefault: "desc" }],
      })) ??
      (await prisma.iDCardTemplate.findFirst({
        where: { isActive: true, OR: [{ schoolId }, { isSystemTemplate: true }] },
      }));

    if (!template) {
      return NextResponse.json(
        { error: "No ID card template exists yet. Create one in the Designer first." },
        { status: 409 },
      );
    }

    const elements = (await prisma.designElement.findMany({
      where: { templateId: template.id },
      orderBy: { zIndex: "asc" },
    })) as DesignElementLike[];

    const fields = student ? resolveStudentFields(student, school) : resolveStaffFields(staff!, school);
    const reference = student ? student.admissionNumber : staff!.employeeId;
    const photoUrl = student ? student.photoUrl : staff!.photoUrl;
    const code = (student ?? staff)!.qrVerification?.code;
    const name = student
      ? [student.firstName, student.lastName].filter(Boolean).join(" ")
      : staff!.fullName;

    const [photoBytes, logoBytes] = await Promise.all([
      readBytesFromStoredUrl(photoUrl),
      readBytesFromStoredUrl(school.logoUrl),
    ]);

    const pdf = await renderCardPdf({
      cardWidthMm: template.cardWidthMm,
      cardHeightMm: template.cardHeightMm,
      elements,
      fieldValues: fields,
      qrValue: code ? verificationUrl(request.nextUrl.origin, code) : undefined,
      barcodeValue: existingCard?.barcodeValue ?? existingCard?.cardNumber ?? reference,
      photoBytes,
      logoBytes,
    });

    // Filenames come from the person's own reference so a batch of downloads
    // stays sortable in a folder.
    const safeName = `${reference}-${name}`.replace(/[^a-zA-Z0-9._-]+/g, "-");

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="id-card-${safeName}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
