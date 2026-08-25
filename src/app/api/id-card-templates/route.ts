import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";

/** System templates (schoolId = null, shared read-only) + this school's own saved templates. */
export async function GET() {
  try {
  const { schoolId } = await requirePermission("idCards", "view");

  const templates = await prisma.iDCardTemplate.findMany({
    where: { OR: [{ isSystemTemplate: true }, { schoolId }] },
    include: { elements: true },
    orderBy: [{ isSystemTemplate: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ data: templates });
  } catch (error) {
    return apiError(error);
  }
}
