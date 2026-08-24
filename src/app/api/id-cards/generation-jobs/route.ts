import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";

export async function GET() {
  const schoolId = await getCurrentSchoolId();
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
}
