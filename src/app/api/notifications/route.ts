import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import { resolveSchoolNewsStatuses } from "@/lib/news/resolve-status";

export async function GET() {
  const schoolId = await getCurrentSchoolId();
  await resolveSchoolNewsStatuses(schoolId);

  const notifications = await prisma.notification.findMany({
    where: { schoolId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json({ data: notifications });
}
