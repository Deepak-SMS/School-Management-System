import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/authorize";
import { apiError } from "@/lib/api-error";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requirePermission("certificates", "view");
    const { id } = await params;

    const certificate = await prisma.certificate.findFirst({
      where: { id, schoolId },
      include: {
        certificateType: true,
        template: { select: { id: true, name: true } },
        student: { select: { firstName: true, lastName: true, admissionNumber: true } },
        staff: { select: { fullName: true, employeeId: true } },
        generatedBy: { select: { name: true } },
        verification: { select: { code: true, isActive: true } },
      },
    });
    if (!certificate) return NextResponse.json({ error: "Certificate not found." }, { status: 404 });
    return NextResponse.json(certificate);
  } catch (error) {
    return apiError(error);
  }
}
