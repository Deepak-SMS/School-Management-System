import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";

/** "Use Template" / "Save as School Template" — clones a template (system or another school template) into this school's own copy. Never mutates the source. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("idCards", "create");
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : undefined;

    const source = await prisma.iDCardTemplate.findFirst({
      where: { id, OR: [{ isSystemTemplate: true }, { schoolId }] },
      include: { elements: true },
    });
    if (!source) return NextResponse.json({ error: "Template not found." }, { status: 404 });

    const copy = await prisma.iDCardTemplate.create({
      data: {
        schoolId,
        isSystemTemplate: false,
        basedOnTemplateId: source.id,
        name: name ?? `${source.name} (Copy)`,
        category: source.category,
        cardWidthMm: source.cardWidthMm,
        cardHeightMm: source.cardHeightMm,
        cornerRadiusMm: source.cornerRadiusMm,
        orientation: source.orientation,
        isActive: true,
        elements: {
          create: source.elements.map((el) => ({
            side: el.side,
            type: el.type,
            fieldKey: el.fieldKey,
            content: el.content,
            x: el.x,
            y: el.y,
            width: el.width,
            height: el.height,
            rotation: el.rotation,
            fontSize: el.fontSize,
            fontFamily: el.fontFamily,
            fontWeight: el.fontWeight,
            textAlign: el.textAlign,
            letterSpacing: el.letterSpacing,
            lineHeight: el.lineHeight,
            color: el.color,
            backgroundColor: el.backgroundColor,
            zIndex: el.zIndex,
          })),
        },
      },
      include: { elements: true },
    });

    return NextResponse.json(copy, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
