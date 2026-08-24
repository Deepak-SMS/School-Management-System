import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";

const staffSelect = { id: true, fullName: true, designation: { select: { name: true } } } as const;

function toTeacherRef(staff: { id: string; fullName: string; designation: { name: string } | null }) {
  return { id: staff.id, fullName: staff.fullName, designation: staff.designation?.name ?? "" };
}

/** Read-only: distinct teachers tied to this class (class teacher + subject teachers) for the Class detail page. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const schoolId = await getCurrentSchoolId();
  const { id } = await params;

  const cls = await prisma.class.findFirst({
    where: { id, schoolId },
    include: { classTeacher: { select: staffSelect } },
  });
  if (!cls) return NextResponse.json({ error: "Class not found." }, { status: 404 });

  const assignments = await prisma.subjectAssignment.findMany({
    where: { classId: id, teacherId: { not: null } },
    include: { teacher: { select: staffSelect }, subject: { select: { name: true } } },
  });

  const byId = new Map<string, { id: string; fullName: string; designation: string; subjects: string[] }>();
  if (cls.classTeacher) {
    byId.set(cls.classTeacher.id, { ...toTeacherRef(cls.classTeacher), subjects: ["Class Teacher"] });
  }
  for (const a of assignments) {
    if (!a.teacher) continue;
    const existing = byId.get(a.teacher.id);
    if (existing) existing.subjects.push(a.subject.name);
    else byId.set(a.teacher.id, { ...toTeacherRef(a.teacher), subjects: [a.subject.name] });
  }

  return NextResponse.json({ data: [...byId.values()] });
}
