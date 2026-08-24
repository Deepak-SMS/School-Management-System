import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";

/**
 * The employee's activity timeline. Read-only by design — timeline rows are
 * written only as a side effect of the change they describe, so there is no
 * create/update/delete route for them.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("employees", "view");
    const { id } = await params;
    const limit = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? 50)));

    const staff = await prisma.staff.findFirst({ where: { id, schoolId }, select: { id: true } });
    if (!staff) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

    const data = await prisma.staffActivityLog.findMany({
      where: { staffId: id, schoolId },
      orderBy: { occurredAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
