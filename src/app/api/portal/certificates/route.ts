import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { resolvePortalStudent } from "@/lib/portal-scope";
import { apiError } from "@/lib/api-error";

/** A student/parent's own issued certificates — same query shape as src/app/api/certificates/route.ts, filtered to one student and only ever-visible statuses. */
export async function GET(request: NextRequest) {
  try {
    await requirePermission("certificates", "view");
    const { studentId } = await resolvePortalStudent(request.nextUrl.searchParams.get("studentId"));

    const rows = await prisma.certificate.findMany({
      where: { studentId, status: { in: ["generated", "issued"] } },
      include: {
        certificateType: { select: { name: true, category: true } },
      },
      orderBy: { issueDate: "desc" },
    });

    return NextResponse.json({ data: rows });
  } catch (error) {
    return apiError(error);
  }
}
