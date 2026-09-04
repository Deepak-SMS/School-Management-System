import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { subjectAssignmentScheduleSchema } from "@/lib/validation/timetable";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

/**
 * Sets the timetable generator's workload input on an existing
 * SubjectAssignment — periods/week, double-period preference, preferred
 * room. Gated by `timetable:edit` (not `subjects:edit`): this is timetable
 * configuration living on the assignment row, not a change to who teaches what.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  try {
    const { schoolId } = await requirePermission("timetable", "edit");
    const { id: subjectId, assignmentId } = await params;
    const body = await request.json();
    const input = cleanEmptyStrings(subjectAssignmentScheduleSchema.parse(body));

    const existing = await prisma.subjectAssignment.findFirst({ where: { id: assignmentId, subjectId, schoolId } });
    if (!existing) return NextResponse.json({ error: "Assignment not found." }, { status: 404 });

    const updated = await prisma.subjectAssignment.update({
      where: { id: assignmentId },
      data: {
        periodsPerWeek: input.periodsPerWeek,
        preferDoublePeriod: input.preferDoublePeriod,
        preferredRoomId: input.preferredRoomId ?? null,
      },
      include: {
        academicYear: { select: { id: true, label: true } },
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        teacher: { select: { id: true, fullName: true } },
        preferredRoom: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}

/** Removes a subject's assignment to a class/section entirely — the subject itself and other classes taking it are unaffected. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  try {
    const { schoolId } = await requirePermission("subjects", "edit");
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
