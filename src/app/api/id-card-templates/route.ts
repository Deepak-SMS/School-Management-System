import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";

/** System templates (schoolId = null, shared read-only) + this school's own saved templates. */
export async function GET() {
  const schoolId = await getCurrentSchoolId();

  const templates = await prisma.iDCardTemplate.findMany({
    where: { OR: [{ isSystemTemplate: true }, { schoolId }] },
    include: { elements: true },
    orderBy: [{ isSystemTemplate: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ data: templates });
}
