import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";

/** Read-only: subjects assigned to this section — either directly, or via a whole-class assignment (sectionId = null). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const schoolId = await getCurrentSchoolId();
  const { id } = await params;

  const section = await prisma.section.findFirst({ where: { id, schoolId } });
  if (!section) return NextResponse.json({ error: "Section not found." }, { status: 404 });

  const assignments = await prisma.subjectAssignment.findMany({
    where: { classId: section.classId, OR: [{ sectionId: id }, { sectionId: null }] },
    include: { subject: true, teacher: { select: { id: true, fullName: true } } },
    orderBy: { subject: { name: "asc" } },
  });

  return NextResponse.json({
    data: assignments.map((a) => ({ ...a.subject, teacher: a.teacher, assignmentId: a.id })),
  });
}
