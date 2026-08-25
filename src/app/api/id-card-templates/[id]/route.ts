import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const { schoolId } = await requirePermission("idCards", "view");
  const { id } = await params;

  const template = await prisma.iDCardTemplate.findFirst({
    where: { id, OR: [{ isSystemTemplate: true }, { schoolId }] },
    include: { elements: { orderBy: { zIndex: "asc" } } },
  });
  if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });
  return NextResponse.json(template);
  } catch (error) {
    return apiError(error);
  }
}
