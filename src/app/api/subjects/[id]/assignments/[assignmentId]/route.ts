import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  try {
    const schoolId = await getCurrentSchoolId();
    const { id: subjectId, assignmentId } = await params;

    const existing = await prisma.subjectAssignment.findFirst({ where: { id: assignmentId, subjectId, schoolId } });
    if (!existing) return NextResponse.json({ error: "Assignment not found." }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.subjectAssignment.delete({ where: { id: assignmentId } });
      await recordAudit(tx, {
        schoolId,
        action: "subjectAssignment.delete",
        entityType: "SubjectAssignment",
        entityId: assignmentId,
        before: existing,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
