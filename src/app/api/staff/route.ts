import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import { staffInputSchema } from "@/lib/validation/staff";
import { createQrVerification } from "@/lib/qr-verification";
import { apiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  const schoolId = await getCurrentSchoolId();
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 20)));
  const q = params.get("q")?.trim();
  const category = params.get("category") ?? undefined;
  const employmentStatus = params.get("employmentStatus") ?? undefined;

  const where: Prisma.StaffWhereInput = {
    schoolId,
    ...(category && { category }),
    ...(employmentStatus && { employmentStatus }),
    ...(q && {
      OR: [{ fullName: { contains: q } }, { employeeId: { contains: q } }, { designation: { contains: q } }],
    }),
  };

  const [data, total] = await Promise.all([
    prisma.staff.findMany({
      where,
      orderBy: { fullName: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.staff.count({ where }),
  ]);

  return NextResponse.json({ data, total, page, pageSize });
}

export async function POST(request: NextRequest) {
  try {
    const schoolId = await getCurrentSchoolId();
    const body = await request.json();
    const input = staffInputSchema.parse(body);

    const staff = await prisma.$transaction(async (tx) => {
      const created = await tx.staff.create({
        data: {
          schoolId,
          employeeId: input.employeeId,
          fullName: input.fullName,
          photoUrl: input.photoUrl,
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
          gender: input.gender,
          bloodGroup: input.bloodGroup,
          designation: input.designation,
          department: input.department,
          category: input.category,
          mobileNumber: input.mobileNumber,
          email: input.email,
          emergencyContact: input.emergencyContact,
          address: input.address,
          joiningDate: input.joiningDate ? new Date(input.joiningDate) : undefined,
          employeeType: input.employeeType,
          employmentStatus: input.employmentStatus,
        },
      });
      await createQrVerification(tx, { schoolId, staffId: created.id });
      return created;
    });

    return NextResponse.json(staff, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
