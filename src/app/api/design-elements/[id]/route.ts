import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { designElementUpdateSchema } from "@/lib/validation/design-element";
import { apiError } from "@/lib/api-error";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("idCards", "edit");
    const { id } = await params;
    const body = await request.json();
    const input = designElementUpdateSchema.parse(body);

    const element = await prisma.designElement.findFirst({ where: { id }, include: { template: true } });
    if (!element) return NextResponse.json({ error: "Element not found." }, { status: 404 });
    if (element.template.isSystemTemplate || element.template.schoolId !== schoolId) {
      return NextResponse.json({ error: "System templates are read-only — duplicate them first to customize." }, { status: 403 });
    }

    const updated = await prisma.designElement.update({ where: { id }, data: input });
    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}
