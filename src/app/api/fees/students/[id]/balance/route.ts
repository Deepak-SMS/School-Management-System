import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authorize";
import { prisma } from "@/lib/db";
import { getStudentBalance } from "@/lib/fees/balance";
import { apiError } from "@/lib/api-error";

/** What a student owes right now — what the payment form is filled in against. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("studentFees", "view");
    const { id } = await params;

    const student = await prisma.student.findFirst({
      where: { id, schoolId },
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        admissionNumber: true,
        class: { select: { name: true } },
        section: { select: { name: true } },
      },
    });
    if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

    const balance = await getStudentBalance(prisma, schoolId, id);
    return NextResponse.json({ student, ...balance });
  } catch (error) {
    return apiError(error);
  }
}
