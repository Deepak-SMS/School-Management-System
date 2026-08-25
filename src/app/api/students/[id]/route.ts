import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { studentInputSchema, cleanEmptyStrings } from "@/lib/validation/student";
import { buildStudentGuardianCreates } from "@/lib/students/guardian-input";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("students", "view");
    const { id } = await params;

    const student = await prisma.student.findFirst({
      where: { id, schoolId },
      include: {
        class: true,
        section: true,
        academicYear: true,
        qrVerification: true,
        guardians: { include: { guardian: true }, orderBy: { sortOrder: "asc" } },
      },
    });
    if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

    return NextResponse.json(student);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("students", "edit");
    const { schoolId } = user;
    const { id } = await params;
    const { guardians, ...input } = cleanEmptyStrings(studentInputSchema.partial().parse(await request.json()));

    const existing = await prisma.student.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Student not found." }, { status: 404 });

    // A section must belong to whichever class the student will be in after this
    // edit, not the one they were in before.
    const targetClassId = input.classId ?? existing.classId;
    if (input.sectionId) {
      const section = await prisma.section.findFirst({
        where: { id: input.sectionId, schoolId, classId: targetClassId },
        select: { id: true },
      });
      if (!section) {
        return NextResponse.json({ error: "That section doesn't belong to the selected class." }, { status: 422 });
      }
    }

    // Captured before the replace so the people left behind can be tidied up.
    const previousGuardianIds =
      guardians === undefined
        ? []
        : (
            await prisma.studentGuardian.findMany({ where: { studentId: id }, select: { guardianId: true } })
          ).map((g) => g.guardianId);

    const student = await prisma.$transaction(async (tx) => {
      const updated = await tx.student.update({
        where: { id },
        data: {
          ...input,
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
          admissionDate: input.admissionDate ? new Date(input.admissionDate) : undefined,
          // Guardians are replaced wholesale when the form sends them, because
          // the form owns that whole block. Omitting the field leaves existing
          // guardians untouched.
          ...(guardians !== undefined && {
            guardians: { deleteMany: {}, create: buildStudentGuardianCreates(schoolId, guardians) },
          }),
        },
      });

      // Replacing the block unlinks the old guardians; a guardian left with no
      // students at all is litter, but one still linked to a sibling stays.
      if (previousGuardianIds.length > 0) {
        await tx.guardian.deleteMany({
          where: { id: { in: previousGuardianIds }, schoolId, students: { none: {} } },
        });
      }

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "student.update",
        entityType: "Student",
        entityId: id,
        before: existing,
        after: updated,
      });

      return updated;
    });

    return NextResponse.json(student);
  } catch (error) {
    return apiError(error);
  }
}

/**
 * Removes a student record. Kept as a real delete because a mis-keyed admission
 * should be removable — withdrawing a student who actually attended is a status
 * change (`transferred` / `graduated` / `withdrawn`) instead.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("students", "delete");
    const { schoolId } = user;
    const { id } = await params;

    const existing = await prisma.student.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Student not found." }, { status: 404 });

    const guardianIds = (
      await prisma.studentGuardian.findMany({ where: { studentId: id }, select: { guardianId: true } })
    ).map((g) => g.guardianId);

    await prisma.$transaction(async (tx) => {
      await tx.student.delete({ where: { id } });

      // The links cascade with the student; the guardians themselves only go if
      // no sibling still points at them.
      if (guardianIds.length > 0) {
        await tx.guardian.deleteMany({ where: { id: { in: guardianIds }, schoolId, students: { none: {} } } });
      }

      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "student.delete",
        entityType: "Student",
        entityId: id,
        before: { admissionNumber: existing.admissionNumber, name: `${existing.firstName} ${existing.lastName}` },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
