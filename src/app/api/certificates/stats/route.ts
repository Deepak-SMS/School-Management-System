import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";

export async function GET() {
  try {
    const { schoolId } = await requirePermission("certificates", "view");

    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [total, thisYear, byStatus] = await Promise.all([
      prisma.certificate.count({ where: { schoolId } }),
      prisma.certificate.count({ where: { schoolId, createdAt: { gte: yearStart } } }),
      prisma.certificate.groupBy({ by: ["status"], where: { schoolId }, _count: true }),
    ]);

    const statusCounts = Object.fromEntries(byStatus.map((row) => [row.status, row._count]));

    return NextResponse.json({
      total,
      generatedThisYear: thisYear,
      issued: statusCounts.generated ?? 0,
      revoked: statusCounts.revoked ?? 0,
    });
  } catch (error) {
    return apiError(error);
  }
}
