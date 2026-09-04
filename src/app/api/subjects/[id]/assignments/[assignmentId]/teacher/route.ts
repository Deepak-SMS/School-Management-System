import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

const teacherInputSchema = z.object({ teacherId: z.string().trim().min(1).nullable() });

/**
 * Changes, or clears, which teacher is on an existing SubjectAssignment.
 * Its own route (rather than folded into the sibling PATCH) because that one
 * is gated by `timetable:edit` for workload config — this is "who teaches
 * this," gated by `subjects:edit`.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  try {
    const { schoolId } = await requirePermission("subjects", "edit");
    const { id: subjectId, assignmentId } = await params;
    const { teacherId } = teacherInputSchema.parse(await request.json());

    const existing = await prisma.subjectAssignment.findFirst({ where: { id: assignmentId, subjectId, schoolId } });
    if (!existing) return NextResponse.json({ error: "Assignment not found." }, { status: 404 });

    if (teacherId) {
      const teacher = await prisma.staff.findFirst({ where: { id: teacherId, schoolId }, select: { id: true } });
      if (!teacher) return NextResponse.json({ error: "Teacher not found." }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.subjectAssignment.update({
        where: { id: assignmentId },
        data: { teacherId },
        include: {
          academicYear: { select: { id: true, label: true } },
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
          teacher: { select: { id: true, fullName: true } },
          preferredRoom: { select: { id: true, name: true } },
        },
      });
      await recordAudit(tx, {
        schoolId,
        action: "subjectAssignment.teacher_changed",
        entityType: "SubjectAssignment",
        entityId: assignmentId,
        before: { teacherId: existing.teacherId },
        after: { teacherId: row.teacherId },
      });
      return row;
    });

    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}
