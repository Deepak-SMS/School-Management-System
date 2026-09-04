import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";
import { studentFeeChargeInclude, buildStudentFeeAccount } from "@/lib/student-fee-response";

/** A student's full financial account — every charge (structure-generated, opted-in, or ad-hoc), its adjustment history, and the rolled-up totals. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("studentFees", "view");
    const { id } = await params;

    const student = await prisma.student.findFirst({
      where: { id, schoolId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNumber: true,
        photoUrl: true,
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
    });
    if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

    const charges = await prisma.studentFeeCharge.findMany({
      where: { studentId: id, schoolId },
      include: studentFeeChargeInclude,
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ student, ...buildStudentFeeAccount(charges) });
  } catch (error) {
    return apiError(error);
  }
}
