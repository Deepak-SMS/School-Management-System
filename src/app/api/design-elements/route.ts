import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { designElementCreateSchema } from "@/lib/validation/design-element";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { apiError } from "@/lib/api-error";

/** Adds a new element (text/shape/photo/logo/signature/qrcode/barcode/dynamic field) to an editable ID card template — the "Add" toolbar actions in the designer. Mirrors POST /api/certificate-design-elements. */
export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("idCards", "edit");
    const body = await request.json();
    const input = cleanEmptyStrings(designElementCreateSchema.parse(body));

    const template = await prisma.iDCardTemplate.findFirst({ where: { id: input.templateId } });
    if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });
    if (template.isSystemTemplate || template.schoolId !== schoolId) {
      return NextResponse.json({ error: "System templates are read-only — duplicate them first to customize." }, { status: 403 });
    }

    const maxZIndex = await prisma.designElement.aggregate({
      where: { templateId: input.templateId },
      _max: { zIndex: true },
    });

    const created = await prisma.designElement.create({
      data: {
        templateId: input.templateId,
        side: input.side,
        type: input.type,
        fieldKey: input.fieldKey,
        content: input.content ?? (input.type === "text" ? "New text" : undefined),
        x: input.x,
        y: input.y,
        width: input.width,
        height: input.height,
        zIndex: (maxZIndex._max.zIndex ?? 0) + 1,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
