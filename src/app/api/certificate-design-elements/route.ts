import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { certificateDesignElementCreateSchema } from "@/lib/validation/certificate-design-element";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { apiError } from "@/lib/api-error";

/** Adds a new element (text/image/shape/line/...) to an editable template — the "Add" toolbar actions in the designer. */
export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("certificateTypes", "edit");
    const body = await request.json();
    const input = cleanEmptyStrings(certificateDesignElementCreateSchema.parse(body));

    const template = await prisma.certificateTemplate.findFirst({ where: { id: input.templateId } });
    if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });
    if (template.isSystemTemplate || template.schoolId !== schoolId) {
      return NextResponse.json({ error: "System templates are read-only — duplicate them first to customize." }, { status: 403 });
    }

    const maxZIndex = await prisma.certificateDesignElement.aggregate({
      where: { templateId: input.templateId },
      _max: { zIndex: true },
    });

    const created = await prisma.certificateDesignElement.create({
      data: {
        templateId: input.templateId,
        side: input.side,
        type: input.type,
        fieldKey: input.fieldKey,
        content: input.content ?? (input.type === "text" ? "New text" : undefined),
        imageUrl: input.imageUrl,
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
