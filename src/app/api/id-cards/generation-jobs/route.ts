import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";

export async function GET() {
  try {
  const { schoolId } = await requirePermission("idCards", "view");
  const jobs = await prisma.iDCardGenerationJob.findMany({
    where: { schoolId },
    include: {
      template: true,
      items: { include: { student: { select: { firstName: true, lastName: true, admissionNumber: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ data: jobs });
  } catch (error) {
    return apiError(error);
  }
}
