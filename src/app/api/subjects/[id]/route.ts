import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { subjectUpdateSchema } from "@/lib/validation/subject";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const { schoolId } = await requirePermission("subjects", "view");
  const { id } = await params;
  const subject = await prisma.subject.findFirst({ where: { id, schoolId } });
  if (!subject) return NextResponse.json({ error: "Subject not found." }, { status: 404 });

  const assignments = await prisma.subjectAssignment.findMany({
    where: { subjectId: id },
    include: {
      academicYear: { select: { id: true, label: true } },
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      teacher: { select: { id: true, fullName: true } },
      preferredRoom: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const classes = new Set(assignments.map((a) => a.classId)).size;
  const teachers = new Set(assignments.map((a) => a.teacherId).filter((v): v is string => Boolean(v))).size;

  return NextResponse.json({ ...subject, counts: { classes, teachers }, assignments });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("subjects", "edit");
    const { id } = await params;
    const body = await request.json();
    const input = cleanEmptyStrings(subjectUpdateSchema.parse(body));

    const existing = await prisma.subject.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Subject not found." }, { status: 404 });

    const subject = await prisma.$transaction(async (tx) => {
      const updated = await tx.subject.update({ where: { id }, data: input });
      await recordAudit(tx, { schoolId, action: "subject.update", entityType: "Subject", entityId: id, before: existing, after: updated });
      return updated;
    });

    return NextResponse.json(subject);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("subjects", "delete");
    const { id } = await params;
    const existing = await prisma.subject.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Subject not found." }, { status: 404 });

    // SubjectAssignment cascades on delete, so it alone wouldn't block this —
    // but Attendance, LibraryBook, and TimetableSlot all reference Subject
    // without cascading, and a subject can pick up a TimetableSlot/Attendance
    // row without ever having a formal SubjectAssignment. Checking all four
    // up front gives an honest, specific message instead of a raw FK failure.
    const [assignments, attendanceRecords, libraryBooks, timetableSlots] = await Promise.all([
      prisma.subjectAssignment.count({ where: { subjectId: id } }),
      prisma.attendance.count({ where: { subjectId: id } }),
      prisma.libraryBook.count({ where: { subjectId: id } }),
      prisma.timetableSlot.count({ where: { subjectId: id } }),
    ]);
    if (assignments > 0 || attendanceRecords > 0 || libraryBooks > 0 || timetableSlots > 0) {
      return NextResponse.json(
        { error: "This subject is in use (assigned to a class, a timetable, attendance records, or library books). Deactivate it instead of deleting." },
        { status: 409 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.subject.delete({ where: { id } });
      await recordAudit(tx, { schoolId, action: "subject.delete", entityType: "Subject", entityId: id, before: existing });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
