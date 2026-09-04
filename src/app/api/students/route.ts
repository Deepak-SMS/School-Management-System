import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { studentInputSchema } from "@/lib/validation/student";
import { validateStudentPlacement, createStudentWithGuardians } from "@/lib/students/create-student";
import { assertAdmissionNumberAvailable } from "@/lib/students/admission-number";
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
          { rollNumber: { contains: q } },
        ],
      }),
    };

    const [rows, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: {
          class: { select: { id: true, name: true, classTeacher: { select: { id: true, fullName: true } } } },
          section: { select: { id: true, name: true, classTeacher: { select: { id: true, fullName: true } } } },
          academicYear: { select: { id: true, label: true } },
          guardians: {
            orderBy: { sortOrder: "asc" },
            select: { isPrimary: true, guardian: { select: { mobile: true } } },
          },
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.student.count({ where }),
    ]);

    // The section's own class teacher takes priority — that's the specific
    // 5-A/5-B teacher — falling back to the class-wide one if the section
    // hasn't been assigned its own. Guardian mobile: whichever one is flagged
    // primary, else just the first on file.
    const data = rows.map(({ guardians, ...student }) => ({
      ...student,
      classTeacher: student.section?.classTeacher ?? student.class.classTeacher ?? null,
      parentMobile: (guardians.find((g) => g.isPrimary) ?? guardians[0])?.guardian.mobile ?? null,
    }));

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("students", "create");
    const { schoolId } = user;
    const input = studentInputSchema.parse(await request.json());

    // Class, section and year must belong to this school, and the section must
    // belong to the chosen class — otherwise a guessed id could enrol a student
    // into another tenant's class.
    await validateStudentPlacement(schoolId, input);
    await assertAdmissionNumberAvailable(schoolId, input.admissionNumber);

    const student = await prisma.$transaction((tx) => createStudentWithGuardians(tx, schoolId, user.id, input));

    return NextResponse.json(student, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
