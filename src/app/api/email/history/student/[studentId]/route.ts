import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";

/** Every email ever sent about one student (spec §29) — the campaign name and status per send, for the student profile's Communication History. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  try {
    const { schoolId } = await requirePermission("emailCampaigns", "view");
    const { studentId } = await params;

    const student = await prisma.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true } });
    if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

    const data = await prisma.emailJob.findMany({
      where: { studentId, schoolId },
      orderBy: { queuedAt: "desc" },
      include: { campaign: { select: { name: true } } },
    });

    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    return apiError(error);
  }
}
