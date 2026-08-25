import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { resolveStudentFields, resolveStaffFields } from "@/lib/id-cards/resolve-fields";
import { apiError } from "@/lib/api-error";

/**
 * Everything needed to render one person's ID card: the template's dimensions
 * and elements, plus their real field values.
 *
 * The same `resolveStudentFields`/`resolveStaffFields` used by PDF generation
 * produce the values here, so the on-screen preview and the printed card can't
 * drift apart.
 *
 * If the person already has a card, its own template is used; otherwise the
 * school's default for that category, so a pending card previews as it would
 * actually print.
 */
export async function GET(
  _request: NextRequest,
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

    // Kept as two separate variables rather than a union — TypeScript can't
    // narrow a ternary of two different models, and the branches diverge anyway.
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

    // Prefer the card's own template; otherwise the school default for this
    // category, then any system template so a preview is always possible.
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
        orderBy: [{ isSystemTemplate: "asc" }],
      }));

    if (!template) {
      return NextResponse.json(
        { error: "No ID card template exists yet. Create one before previewing cards." },
        { status: 409 },
      );
    }

    const elements = await prisma.designElement.findMany({
      where: { templateId: template.id },
      orderBy: { zIndex: "asc" },
    });

    const fields = student ? resolveStudentFields(student, school) : resolveStaffFields(staff!, school);

    const name = student
      ? [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ")
      : staff!.fullName;
    const reference = student ? student.admissionNumber : staff!.employeeId;
    const photoUrl = student ? student.photoUrl : staff!.photoUrl;
    const verificationCode = (student ?? staff)!.qrVerification?.code ?? null;

    return NextResponse.json({
      person: { id, type, name, reference, photoUrl },
      template: {
        id: template.id,
        name: template.name,
        cardWidthMm: template.cardWidthMm,
        cardHeightMm: template.cardHeightMm,
        cornerRadiusMm: template.cornerRadiusMm,
        orientation: template.orientation,
      },
      elements,
      fields,
      schoolLogoUrl: school.logoUrl,
      verificationCode,
      // What a barcode element encodes — the card number if issued, else the
      // person's own reference.
      barcodeValue: existingCard?.barcodeValue ?? existingCard?.cardNumber ?? reference,
      card: existingCard
        ? {
            id: existingCard.id,
            status: existingCard.status,
            cardNumber: existingCard.cardNumber,
            issuedAt: existingCard.issuedAt,
            expiresAt: existingCard.expiresAt,
          }
        : null,
    });
  } catch (error) {
    return apiError(error);
  }
}
