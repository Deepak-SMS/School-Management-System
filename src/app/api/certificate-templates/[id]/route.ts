import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { certificateTemplateUpdateSchema } from "@/lib/validation/certificate-template";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { apiError } from "@/lib/api-error";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("certificateTypes", "view");
    const { id } = await params;

    const template = await prisma.certificateTemplate.findFirst({
      where: { id, OR: [{ isSystemTemplate: true }, { schoolId }] },
      include: { elements: { orderBy: { zIndex: "asc" } }, certificateType: true },
    });
    if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });
    return NextResponse.json(template);
  } catch (error) {
    return apiError(error);
  }
}

/** Renames, sets the background/frame art, or resizes the page — everything about a template except its elements. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("certificateTypes", "edit");
    const { id } = await params;
    const input = cleanEmptyStrings(certificateTemplateUpdateSchema.parse(await request.json()));

    const existing = await prisma.certificateTemplate.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Template not found." }, { status: 404 });
    if (existing.isSystemTemplate || existing.schoolId !== schoolId) {
      return NextResponse.json({ error: "System templates are read-only — duplicate them first to customize." }, { status: 403 });
    }

    const updated = await prisma.certificateTemplate.update({
      where: { id },
      data: input,
      include: { elements: { orderBy: { zIndex: "asc" } }, certificateType: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}
