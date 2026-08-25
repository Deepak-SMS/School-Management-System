import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

const updateSchema = z.object({
  /** Empty string clears the teacher, which is different from omitting the field. */
  teacherId: z.string().trim().nullable().optional(),
});

/** Changes the teacher on one class-subject assignment. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> },
) {
  try {
    const user = await requirePermission("subjects", "edit");
    const { schoolId } = user;
    const { id, assignmentId } = await params;

    const existing = await prisma.subjectAssignment.findFirst({
      where: { id: assignmentId, classId: id, schoolId },
      include: { subject: { select: { name: true } }, teacher: { select: { fullName: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Assignment not found." }, { status: 404 });

    const input = updateSchema.parse(await request.json());
    const teacherId = input.teacherId === "" ? null : input.teacherId;

    if (teacherId) {
      const teacher = await prisma.staff.findFirst({ where: { id: teacherId, schoolId }, select: { id: true } });
      if (!teacher) return NextResponse.json({ error: "Teacher not found." }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.subjectAssignment.update({
        where: { id: assignmentId },
        data: { teacherId },
        include: { teacher: { select: { id: true, fullName: true } } },
      });

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "subject.assignment.update",
        entityType: "SubjectAssignment",
        entityId: assignmentId,
        before: { subject: existing.subject.name, teacher: existing.teacher?.fullName ?? null },
        after: { subject: existing.subject.name, teacher: row.teacher?.fullName ?? null },
      });

      return row;
    });

    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}

/**
 * Removes the subject from this class. Only the assignment row goes — the
 * Subject itself stays, because other classes may still take it.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> },
) {
  try {
    const user = await requirePermission("subjects", "delete");
    const { schoolId } = user;
    const { id, assignmentId } = await params;

    const existing = await prisma.subjectAssignment.findFirst({
      where: { id: assignmentId, classId: id, schoolId },
      include: { subject: { select: { id: true, name: true } }, section: { select: { name: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Assignment not found." }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.subjectAssignment.delete({ where: { id: assignmentId } });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "subject.unassign",
        entityType: "Class",
        entityId: id,
        before: {
          subject: existing.subject.name,
          section: existing.section?.name ?? "All sections",
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
