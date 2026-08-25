import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { studentInputSchema, cleanEmptyStrings, DEFAULT_STUDENT_STATUS } from "@/lib/validation/student";
import { buildStudentGuardianCreates } from "@/lib/students/guardian-input";
import { createQrVerification } from "@/lib/qr-verification";
import { recordAudit } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission("students", "view");
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 20)));
    const q = params.get("q")?.trim();
    const classId = params.get("classId") ?? undefined;
    const sectionId = params.get("sectionId") ?? undefined;
    const status = params.get("status") ?? undefined;

    const where: Prisma.StudentWhereInput = {
      schoolId,
      ...(classId && { classId }),
      ...(sectionId && { sectionId }),
      ...(status && { status }),
      ...(q && {
        OR: [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
          { admissionNumber: { contains: q } },
          { enrollmentNumber: { contains: q } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: {
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
          academicYear: { select: { id: true, label: true } },
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.student.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("students", "create");
    const { schoolId } = user;
    const { guardians, ...input } = cleanEmptyStrings(studentInputSchema.parse(await request.json()));

    // Class, section and year must belong to this school, and the section must
    // belong to the chosen class — otherwise a guessed id could enrol a student
    // into another tenant's class.
    const [academicYear, cls] = await Promise.all([
      prisma.academicYear.findFirst({ where: { id: input.academicYearId, schoolId }, select: { id: true } }),
      prisma.class.findFirst({ where: { id: input.classId, schoolId }, select: { id: true } }),
    ]);
    if (!academicYear) return NextResponse.json({ error: "Academic year not found." }, { status: 404 });
    if (!cls) return NextResponse.json({ error: "Class not found." }, { status: 404 });

    if (input.sectionId) {
      const section = await prisma.section.findFirst({
        where: { id: input.sectionId, schoolId, classId: input.classId },
        select: { id: true },
      });
      if (!section) {
        return NextResponse.json({ error: "That section doesn't belong to the selected class." }, { status: 422 });
      }
    }

    const student = await prisma.$transaction(async (tx) => {
      const created = await tx.student.create({
        data: {
          schoolId,
          ...input,
          status: input.status ?? DEFAULT_STUDENT_STATUS,
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
          admissionDate: input.admissionDate ? new Date(input.admissionDate) : undefined,
          guardians: { create: buildStudentGuardianCreates(schoolId, guardians) },
        },
      });

      await createQrVerification(tx, { schoolId, studentId: created.id });
      await recordAudit(tx, {
        schoolId,
        userId: user.id,
        action: "student.create",
        entityType: "Student",
        entityId: created.id,
        after: { admissionNumber: created.admissionNumber, name: `${created.firstName} ${created.lastName}` },
      });

      return created;
    });

    return NextResponse.json(student, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
