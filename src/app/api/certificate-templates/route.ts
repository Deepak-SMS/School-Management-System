import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { certificateTemplateCreateSchema } from "@/lib/validation/certificate-template";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

/** System templates (schoolId = null, shared read-only) + this school's own — same pattern as ID card templates. */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("certificateTypes", "view");
    const certificateTypeId = request.nextUrl.searchParams.get("certificateTypeId") ?? undefined;

    const where: Prisma.CertificateTemplateWhereInput = {
      OR: [{ isSystemTemplate: true }, { schoolId }],
      ...(certificateTypeId && { certificateTypeId }),
    };

    const templates = await prisma.certificateTemplate.findMany({
      where,
      include: { elements: true, certificateType: { select: { id: true, name: true, category: true } } },
      orderBy: [{ isSystemTemplate: "desc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ data: templates });
  } catch (error) {
    return apiError(error);
  }
}

/** Starts a blank template for a certificate type — zero elements, ready for a background upload and Add-element toolbar. */
export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("certificateTypes", "create");
    const input = certificateTemplateCreateSchema.parse(await request.json());

    const type = await prisma.certificateType.findFirst({ where: { id: input.certificateTypeId, OR: [{ isSystemType: true }, { schoolId }] } });
    if (!type) {
      return NextResponse.json({ error: "Validation failed", fieldErrors: { certificateTypeId: ["Certificate type not found."] } }, { status: 422 });
    }

    const template = await prisma.certificateTemplate.create({
      data: {
        schoolId,
        isSystemTemplate: false,
        certificateTypeId: input.certificateTypeId,
        name: input.name,
        pageWidthMm: input.pageWidthMm,
        pageHeightMm: input.pageHeightMm,
        orientation: input.orientation,
        isActive: true,
      },
      include: { elements: true, certificateType: { select: { id: true, name: true, category: true } } },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
