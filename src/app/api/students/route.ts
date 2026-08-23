import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import { studentInputSchema } from "@/lib/validation/student";
import { createQrVerification } from "@/lib/qr-verification";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  const schoolId = await getCurrentSchoolId();
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
      ],
    }),
  };

  const [data, total] = await Promise.all([
    prisma.student.findMany({
      where,
      include: { class: true, section: true, academicYear: true },
      orderBy: [{ class: { sortOrder: "asc" } }, { rollNumber: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.student.count({ where }),
  ]);

  return NextResponse.json({ data, total, page, pageSize });
}

export async function POST(request: NextRequest) {
  try {
    const schoolId = await getCurrentSchoolId();
    const body = await request.json();
    const input = studentInputSchema.parse(body);

    const student = await prisma.$transaction(async (tx) => {
      const created = await tx.student.create({
        data: {
          schoolId,
          admissionNumber: input.admissionNumber,
          firstName: input.firstName,
          middleName: input.middleName,
          lastName: input.lastName,
          photoUrl: input.photoUrl,
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
          gender: input.gender,
          bloodGroup: input.bloodGroup,
          academicYearId: input.academicYearId,
          classId: input.classId,
          sectionId: input.sectionId,
          rollNumber: input.rollNumber,
          house: input.house,
          status: input.status,
          guardianName: input.guardianName,
          guardianPhone: input.guardianPhone,
          emergencyContact: input.emergencyContact,
          address: input.address,
          city: input.city,
          state: input.state,
          country: input.country,
          pinCode: input.pinCode,
          busNumber: input.busNumber,
          route: input.route,
          pickupPoint: input.pickupPoint,
        },
      });
      await createQrVerification(tx, { schoolId, studentId: created.id });
      return created;
    });

    return NextResponse.json(student, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
