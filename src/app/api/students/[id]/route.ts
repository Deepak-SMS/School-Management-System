import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentSchoolId } from "@/lib/tenant";
import { studentInputSchema, cleanEmptyStrings } from "@/lib/validation/student";
import { apiError } from "@/lib/api-error";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const schoolId = await getCurrentSchoolId();
  const { id } = await params;
  const student = await prisma.student.findFirst({
    where: { id, schoolId },
    include: { class: true, section: true, academicYear: true, qrVerification: true },
  });
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });
  return NextResponse.json(student);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const schoolId = await getCurrentSchoolId();
    const { id } = await params;
    const body = await request.json();
    const input = cleanEmptyStrings(studentInputSchema.partial().parse(body));

    const existing = await prisma.student.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Student not found." }, { status: 404 });

    const student = await prisma.student.update({
      where: { id },
      data: {
        ...input,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
      },
    });
    return NextResponse.json(student);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const schoolId = await getCurrentSchoolId();
    const { id } = await params;
    const existing = await prisma.student.findFirst({ where: { id, schoolId } });
    if (!existing) return NextResponse.json({ error: "Student not found." }, { status: 404 });

    await prisma.student.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
