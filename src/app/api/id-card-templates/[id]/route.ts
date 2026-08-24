import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const schoolId = await getCurrentSchoolId();
  const { id } = await params;

  const template = await prisma.iDCardTemplate.findFirst({
    where: { id, OR: [{ isSystemTemplate: true }, { schoolId }] },
    include: { elements: { orderBy: { zIndex: "asc" } } },
  });
  if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });
  return NextResponse.json(template);
}
