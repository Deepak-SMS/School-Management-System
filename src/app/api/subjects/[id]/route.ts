import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import { subjectUpdateSchema } from "@/lib/validation/subject";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const schoolId = await getCurrentSchoolId();
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
    },
    orderBy: { createdAt: "desc" },
  });

  const classes = new Set(assignments.map((a) => a.classId)).size;
  const teachers = new Set(assignments.map((a) => a.teacherId).filter((v): v is string => Boolean(v))).size;

  return NextResponse.json({ ...subject, counts: { classes, teachers }, assignments });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const schoolId = await getCurrentSchoolId();
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
    const schoolId = await getCurrentSchoolId();
    const { id } = await params;
    const existing = await prisma.subject.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Subject not found." }, { status: 404 });

    const assignments = await prisma.subjectAssignment.count({ where: { subjectId: id } });
    if (assignments > 0) {
      return NextResponse.json(
        { error: "This subject is assigned to one or more classes. Deactivate it instead of deleting." },
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
