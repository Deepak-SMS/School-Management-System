import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/platform-auth";
import { apiError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 20)));

    const [entries, total] = await Promise.all([
      prisma.platformAuditLog.findMany({
        include: {
          actor: { select: { id: true, name: true } },
          school: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.platformAuditLog.count(),
    ]);

    const data = entries.map((entry) => ({
      id: entry.id,
      action: entry.action,
      actor: entry.actor,
      targetSchool: entry.school,
      metadata: entry.metadataJson ? JSON.parse(entry.metadataJson) : null,
      createdAt: entry.createdAt.toISOString(),
    }));

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    return apiError(error);
  }
}
