import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import { subjectAssignmentInputSchema } from "@/lib/validation/subject";
import { cleanEmptyStrings } from "@/lib/validation/shared";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const schoolId = await getCurrentSchoolId();
    const { id: subjectId } = await params;
    const body = await request.json();
    const input = cleanEmptyStrings(subjectAssignmentInputSchema.parse(body));

    const subject = await prisma.subject.findFirst({ where: { id: subjectId, schoolId } });
    if (!subject) return NextResponse.json({ error: "Subject not found." }, { status: 404 });

    const cls = await prisma.class.findFirst({ where: { id: input.classId, schoolId } });
    if (!cls) {
      return NextResponse.json({ error: "Validation failed", fieldErrors: { classId: ["Class not found."] } }, { status: 422 });
    }

    const existing = await prisma.subjectAssignment.findFirst({
      where: {
        subjectId,
        academicYearId: input.academicYearId,
        classId: input.classId,
        sectionId: input.sectionId ?? null,
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "This subject is already assigned to that class/section for the selected academic year." },
        { status: 409 },
      );
    }

    const assignment = await prisma.$transaction(async (tx) => {
      const created = await tx.subjectAssignment.create({
        data: {
          schoolId,
          subjectId,
          academicYearId: input.academicYearId,
          classId: input.classId,
          sectionId: input.sectionId,
          teacherId: input.teacherId,
        },
        include: {
          academicYear: { select: { id: true, label: true } },
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
          teacher: { select: { id: true, fullName: true } },
        },
      });
      await recordAudit(tx, {
        schoolId,
        action: "subjectAssignment.create",
        entityType: "SubjectAssignment",
        entityId: created.id,
        after: created,
      });
      return created;
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
