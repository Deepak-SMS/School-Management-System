import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { certificateDesignElementUpdateSchema } from "@/lib/validation/certificate-design-element";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { apiError } from "@/lib/api-error";

async function loadEditableElement(id: string, schoolId: string) {
  const element = await prisma.certificateDesignElement.findFirst({ where: { id }, include: { template: true } });
  if (!element) return { element: null, blocked: null };
  if (element.template.isSystemTemplate || element.template.schoolId !== schoolId) {
    return { element, blocked: "System templates are read-only — duplicate them first to customize." };
  }
  return { element, blocked: null };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("certificateTypes", "edit");
    const { id } = await params;
    const body = await request.json();
    const input = cleanEmptyStrings(certificateDesignElementUpdateSchema.parse(body));

    const { element, blocked } = await loadEditableElement(id, schoolId);
    if (!element) return NextResponse.json({ error: "Element not found." }, { status: 404 });
    if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });

    const updated = await prisma.certificateDesignElement.update({ where: { id }, data: input });
    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("certificateTypes", "edit");
    const { id } = await params;

    const { element, blocked } = await loadEditableElement(id, schoolId);
    if (!element) return NextResponse.json({ error: "Element not found." }, { status: 404 });
    if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });

    await prisma.certificateDesignElement.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
