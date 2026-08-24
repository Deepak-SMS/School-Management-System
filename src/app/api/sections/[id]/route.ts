import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import { sectionInputSchema } from "@/lib/validation/section";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const schoolId = await getCurrentSchoolId();
  const { id } = await params;
  const section = await prisma.section.findFirst({
    where: { id, schoolId },
    include: {
      class: { select: { id: true, name: true } },
      academicYear: { select: { id: true, label: true } },
      campus: { select: { id: true, name: true } },
      classTeacher: { select: { id: true, fullName: true } },
      _count: { select: { students: true } },
    },
  });
  if (!section) return NextResponse.json({ error: "Section not found." }, { status: 404 });

  const { _count, ...rest } = section;
  return NextResponse.json({ ...rest, counts: { students: _count.students } });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const schoolId = await getCurrentSchoolId();
    const { id } = await params;
    const body = await request.json();
    const input = cleanEmptyStrings(sectionInputSchema.partial().parse(body));

    const existing = await prisma.section.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Section not found." }, { status: 404 });

    const section = await prisma.$transaction(async (tx) => {
      const updated = await tx.section.update({ where: { id }, data: input });
      await recordAudit(tx, { schoolId, action: "section.update", entityType: "Section", entityId: id, before: existing, after: updated });
      return updated;
    });

    return NextResponse.json(section);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const schoolId = await getCurrentSchoolId();
    const { id } = await params;
    const existing = await prisma.section.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Section not found." }, { status: 404 });

    const students = await prisma.student.count({ where: { sectionId: id } });
    if (students > 0) {
      return NextResponse.json(
        { error: "This section has students assigned to it. Deactivate it instead of deleting." },
        { status: 409 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.section.delete({ where: { id } });
      await recordAudit(tx, { schoolId, action: "section.delete", entityType: "Section", entityId: id, before: existing });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
