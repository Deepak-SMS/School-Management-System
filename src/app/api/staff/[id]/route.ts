import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import { staffInputSchema } from "@/lib/validation/staff";
import { apiError } from "@/lib/api-error";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const schoolId = await getCurrentSchoolId();
  const { id } = await params;
  const staff = await prisma.staff.findFirst({ where: { id, schoolId }, include: { qrVerification: true } });
  if (!staff) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
  return NextResponse.json(staff);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const schoolId = await getCurrentSchoolId();
    const { id } = await params;
    const body = await request.json();
    const input = staffInputSchema.partial().parse(body);

    const existing = await prisma.staff.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });

    const staff = await prisma.staff.update({
      where: { id },
      data: {
        ...input,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
        joiningDate: input.joiningDate ? new Date(input.joiningDate) : undefined,
      },
    });
    return NextResponse.json(staff);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const schoolId = await getCurrentSchoolId();
    const { id } = await params;
    const existing = await prisma.staff.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });

    await prisma.staff.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
