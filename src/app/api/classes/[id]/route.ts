import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import { classInputSchema } from "@/lib/validation/class";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const schoolId = await getCurrentSchoolId();
  const { id } = await params;
  const cls = await prisma.class.findFirst({
    where: { id, schoolId },
    include: {
      academicYear: { select: { id: true, label: true } },
      campus: { select: { id: true, name: true } },
      classTeacher: { select: { id: true, fullName: true } },
      _count: { select: { sections: true, students: true } },
    },
  });
  if (!cls) return NextResponse.json({ error: "Class not found." }, { status: 404 });

  const { _count, ...rest } = cls;
  return NextResponse.json({ ...rest, counts: { sections: _count.sections, students: _count.students } });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const schoolId = await getCurrentSchoolId();
    const { id } = await params;
    const body = await request.json();
    const input = cleanEmptyStrings(classInputSchema.partial().parse(body));

    const existing = await prisma.class.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Class not found." }, { status: 404 });

    const cls = await prisma.$transaction(async (tx) => {
      const updated = await tx.class.update({ where: { id }, data: input });
      await recordAudit(tx, { schoolId, action: "class.update", entityType: "Class", entityId: id, before: existing, after: updated });
      return updated;
    });

    return NextResponse.json(cls);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const schoolId = await getCurrentSchoolId();
    const { id } = await params;
    const existing = await prisma.class.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Class not found." }, { status: 404 });

    const sections = await prisma.section.count({ where: { classId: id } });
    const students = await prisma.student.count({ where: { classId: id } });
    if (sections > 0 || students > 0) {
      return NextResponse.json(
        { error: "This class has sections or students assigned to it. Deactivate it instead of deleting." },
        { status: 409 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.class.delete({ where: { id } });
      await recordAudit(tx, { schoolId, action: "class.delete", entityType: "Class", entityId: id, before: existing });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
