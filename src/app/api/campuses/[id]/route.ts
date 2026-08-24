import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import { campusInputSchema } from "@/lib/validation/campus";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const schoolId = await getCurrentSchoolId();
  const { id } = await params;
  const campus = await prisma.campus.findFirst({
    where: { id, schoolId },
    include: {
      head: { select: { id: true, fullName: true } },
      _count: { select: { classes: true, sections: true, departments: true } },
    },
  });
  if (!campus) return NextResponse.json({ error: "Campus not found." }, { status: 404 });

  const students = await prisma.student.count({ where: { schoolId, class: { campusId: id } } });
  const { _count, ...rest } = campus;
  return NextResponse.json({
    ...rest,
    counts: { classes: _count.classes, sections: _count.sections, departments: _count.departments, students },
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const schoolId = await getCurrentSchoolId();
    const { id } = await params;
    const body = await request.json();
    const input = cleanEmptyStrings(campusInputSchema.partial().parse(body));

    const existing = await prisma.campus.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Campus not found." }, { status: 404 });

    const campus = await prisma.$transaction(async (tx) => {
      const updated = await tx.campus.update({ where: { id }, data: input });
      await recordAudit(tx, {
        schoolId,
        action: "campus.update",
        entityType: "Campus",
        entityId: id,
        before: existing,
        after: updated,
      });
      return updated;
    });

    return NextResponse.json(campus);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const schoolId = await getCurrentSchoolId();
    const { id } = await params;
    const existing = await prisma.campus.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Campus not found." }, { status: 404 });

    const dependents = await prisma.class.count({ where: { campusId: id } });
    const departmentCount = await prisma.department.count({ where: { campusId: id } });
    if (dependents > 0 || departmentCount > 0) {
      return NextResponse.json(
        { error: "This campus has classes or departments assigned to it. Deactivate it instead of deleting." },
        { status: 409 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.campus.delete({ where: { id } });
      await recordAudit(tx, { schoolId, action: "campus.delete", entityType: "Campus", entityId: id, before: existing });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
