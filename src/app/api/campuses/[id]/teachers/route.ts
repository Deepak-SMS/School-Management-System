import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";

/** Read-only: distinct class teachers across every class in this campus, for the Campus detail page. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const schoolId = await getCurrentSchoolId();
  const { id } = await params;

  const campus = await prisma.campus.findFirst({ where: { id, schoolId } });
  if (!campus) return NextResponse.json({ error: "Campus not found." }, { status: 404 });

  const classes = await prisma.class.findMany({
    where: { campusId: id, classTeacherId: { not: null } },
    include: { classTeacher: { select: { id: true, fullName: true, designation: { select: { name: true } } } } },
  });

  const byId = new Map<string, { id: string; fullName: string; designation: string; classes: string[] }>();
  for (const cls of classes) {
    if (!cls.classTeacher) continue;
    const teacher = { id: cls.classTeacher.id, fullName: cls.classTeacher.fullName, designation: cls.classTeacher.designation?.name ?? "" };
    const existing = byId.get(teacher.id);
    if (existing) existing.classes.push(cls.name);
    else byId.set(teacher.id, { ...teacher, classes: [cls.name] });
  }

  return NextResponse.json({ data: [...byId.values()] });
}
